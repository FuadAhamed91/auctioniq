"""The ten franchise agents. Same code for all; each has its own squad, purse, slots, home
grounds and a small spending-style factor.

Bid gate: role need, a squad slot, an overseas slot if needed, and a purse that can still
cover the minimum squad. Walk-away price:
    value × need × scarcity × purse pressure × home fit × style × noise
capped at the most the team may bid. A team bids until the price passes its walk-away.
"""
import math

import numpy as np

from config import CFG
from engine import needs, rules
from engine.format import money

A, NE = CFG["agents"], CFG["needs"]
BOWLER_TYPES = ["right-arm pace", "left-arm pace", "off-spin", "left-arm orthodox", "leg-spin", "left-arm wrist spin"]


class Team:
    def __init__(self, i: int, spec: dict, ctx: dict):
        self.i, self.code, self.ctx = i, spec["code"], ctx
        self.purse, self.slots, self.os_slots = spec["purse"], spec["slots"], spec["os_slots"]
        self.size = len(spec["squad"])
        self.style = spec["style"]
        self.home = spec["home_mult"]
        self.squad = needs.Squad(spec["squad"], ctx["P"], ctx["tmpl"], ctx["keep_tmpl"], ctx["factors"])
        self.bought: list[int] = []
        self._refresh()

    def _refresh(self) -> None:
        self.need, self.role, self.kind = self.squad.needs(np.arange(self.ctx["n_pool"]))

    def buy(self, p: int, price: int) -> None:
        self.purse -= price
        self.slots -= 1
        self.os_slots -= int(self.ctx["overseas"][p])
        self.size += 1
        self.bought.append(p)
        self.squad.add(p)
        self._refresh()

    def max_bid(self) -> int:
        return rules.max_bid(self.purse, self.size)

    def pressure(self) -> float:
        if self.slots <= 0:
            return 1.0
        per_slot = (self.purse - rules.RULES["reserve_per_slot"] * max(0, rules.RULES["min_squad"] - self.size)) / self.slots
        ratio = max(per_slot, 1.0) / self.ctx["avg_per_slot"]
        lo, hi = A["pressure_range"]
        return float(np.clip(ratio ** A["pressure_beta"], lo, hi))

    def decide(self, p: int, scarcity: float, market: float, noise: float, detail: bool = False,
               fill: bool = False) -> dict:
        """Gate checks and walk-away price for player p (lakhs). market: how the whole room rates
        him this run; noise: this team's own draw. fill: p is on this team's shortlist for its open
        slots in the last round, so any need counts and it pays at least his base price."""
        ctx = self.ctx
        base, overseas = int(ctx["base"][p]), bool(ctx["overseas"][p])
        need = max(float(self.need[p]), NE["fill"]) if fill else float(self.need[p])
        use_needs = "needs" in ctx["factors"]
        cap = self.max_bid()
        checks = [
            ("need", need >= NE["gate"] or not use_needs),
            ("slot", self.slots > 0),
            ("overseas", not overseas or self.os_slots > 0),
            ("purse", cap >= base),
        ]
        out = {"open": all(ok for _, ok in checks), "cap": cap}
        if out["open"]:
            value = base * A["need_only_multiple"] if ctx["mode"] == "need_only" else ctx["value"][p]
            f = {
                "value": value,
                "need": A["need_floor"] + A["need_slope"] * min(need, A["need_cap"]) if use_needs else 1.0,
                "scarcity": scarcity,
                "pressure": self.pressure(),
                "home": float(self.home[p]),
                "style": self.style,
                "market": market,
                "noise": noise,
            }
            out["f"] = f
            out["raw"] = out["walk"] = math.prod(f.values())
            if fill and out["walk"] < base:
                out["walk"], out["floor"] = float(base), base
        if detail:
            out["gate"] = [(k, ok, self._gate_text(k, ok, p, need, fill, cap)) for k, ok in checks]
        return out

    def chip(self, p: int, fill: bool) -> str:
        if fill:
            return "Filling the squad"
        kind, role = needs.KINDS[self.kind[p]], needs.LABELS[self.role[p]]
        if kind == "keeper":
            return "Need · keeper"
        if kind == "weakness":
            return "Matchup · " + self.weak_label(p)
        return ("Upgrade · " if kind == "upgrade" else "Need · ") + role.lower()

    def weak_label(self, p: int) -> str:
        P = self.ctx["P"]
        if P["lap"][p] and self.squad.lap == 0:
            return "left-arm pace"
        weak = np.clip(-self.squad.weakness() / NE["weakness_cap"], 0, 1)
        t = int(np.argmax(weak * np.clip(P["delta"][p], 0, 1)))
        return "vs " + BOWLER_TYPES[t]

    def _gate_text(self, key: str, ok: bool, p: int, need: float, fill: bool, cap: int) -> str:
        ctx = self.ctx
        if key == "need":
            if fill:
                return f"Last round: filling {self.slots} open slot{'s' * (self.slots != 1)}"
            role = needs.LABELS[self.role[p]]
            if "needs" not in ctx["factors"]:
                return "Needs off (value-only bidder)"
            label = {"depth": f"{role}: depth gap", "upgrade": f"{role}: upgrade",
                     "keeper": "Keeper gap", "weakness": "Lineup weakness"}[needs.KINDS[self.kind[p]]]
            return f"{label} · need {need:.2f}" if ok else f"No real need (score {need:.2f})"
        if key == "slot":
            return f"{self.slots} slot{'s' * (self.slots != 1)} left" if ok else "Squad full"
        if key == "overseas":
            if not ctx["overseas"][p]:
                return "Indian player"
            return f"{self.os_slots} overseas slot{'s' * (self.os_slots != 1)}" if ok else "No overseas slot"
        return f"{money(self.purse)} left, max bid {money(cap)}" if ok else f"Max bid {money(cap)} below base"
