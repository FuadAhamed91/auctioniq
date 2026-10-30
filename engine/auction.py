"""One auction run, following the IPL procedure (docs/AUCTION.md). The first sets are called
set by set, with the order inside each set drawn at random; then an accelerated round of the
players the franchises nominate from the rest of the list; then further accelerated rounds in
which unsold players return, repeated while franchises still fill their squads. Every lot is
written to the run's event log.

Each lot is settled from the teams' walk-away prices alone: the highest walk-away wins and pays
one price point above the runner-up's last affordable bid (or that bid, if the winner cannot go
one higher). The bid-by-bid replay is then built from that result, two paddles at a time as in the
room, so how the war unfolds on screen can never change who wins or the price.
"""
import numpy as np

from config import CFG
from engine import rules
from engine.agents import Team
from engine.format import money

A = CFG["agents"]
UNSOLD = 65535


def market_for(ctx: dict, teams: list[Team], remaining: np.ndarray, p: int) -> tuple[int, float, int]:
    """For the player on the block: comparable players of his role still available (him included),
    the open demand for that role among teams that could buy him (a squad slot, and an overseas slot
    if he is overseas), and how many of those teams are short of one."""
    r = ctx["main"][p]
    worth = ctx["base"] if ctx["mode"] == "need_only" else ctx["value"]  # need-only bidders ignore value
    supply = int(np.count_nonzero(remaining & (ctx["main"][: ctx["n_pool"]] == r)
                                  & (worth >= A["scarcity_comparable"] * worth[p])))
    gaps = [max(0.0, ctx["tmpl"][r] - t.squad.counts[r]) for t in teams
            if t.slots > 0 and (t.os_slots > 0 or not ctx["overseas"][p])]
    return supply, sum(gaps), sum(g >= 0.5 for g in gaps)


def scarcity(ctx: dict, teams: list[Team], remaining: np.ndarray, p: int) -> float:
    """((open demand for his role + 1) / (comparable players still available + 1)) ^ alpha: in a
    mini auction, few options of one type wanted by several teams is what sends prices up."""
    supply, demand, _ = market_for(ctx, teams, remaining, p)
    lo, hi = A["scarcity_range"]
    return float(np.clip(((demand + 1) / (supply + 1)) ** A["scarcity_alpha"], lo, hi))


def settle(walk: dict[int, float], base: int) -> tuple[int, int, int | None]:
    """Winner, price and runner-up from walk-away prices (all at or above base)."""
    ranked = sorted(walk, key=lambda i: (-walk[i], i))
    win = ranked[0]
    if len(ranked) == 1:
        return win, base, None
    run = ranked[1]
    last = base  # the runner-up's last affordable price point
    while rules.next_bid(last) <= walk[run]:
        last = rules.next_bid(last)
    above = rules.next_bid(last)
    return win, (above if above <= walk[win] else last), run


def bid_sequence(walk: dict[int, float], base: int, win: int, price: int,
                 run: int | None) -> tuple[list[int], list[int]]:
    """Who held each price point from base to the final price, two paddles at a time as in the room:
    the runner-up is in from the start and takes on the other bidders one by one, lowest limit first,
    each backing out once the next bid passes its limit; the winner comes in last and outbids him.
    The runner-up opens, or answers the opening bid, so that he holds his last affordable point and
    the winner the price: the sequence always ends in the settled outcome."""
    ladder = [base]
    while ladder[-1] < price:
        ladder.append(rules.next_bid(ladder[-1]))
    n = len(ladder) - 1
    if run is None or n == 0:  # a single bid at base
        return ladder, [win]
    queue = sorted((i for i in walk if i not in (win, run)), key=lambda i: (walk[i], i)) + [win]
    leaders = [run] if (n - 1) % 2 == 0 else [queue.pop(0), run]
    rival = leaders[0] if len(leaders) == 2 else queue.pop(0)
    while len(leaders) <= n:
        p = ladder[len(leaders)]
        # the next bid passes his limit (or is the winner's): he backs out and the next team comes in
        if leaders[-1] == run and (walk[rival] < p or (len(leaders) == n and rival != win)):
            rival = queue.pop(0)
            continue
        leaders.append(rival if leaders[-1] == run else run)
    return ladder, leaders


def simulate(ctx: dict, run: int, detail: set | None = None) -> dict:
    """Play one full auction. `detail` = players whose lots also keep every team's decision."""
    rng = np.random.default_rng([CFG["montecarlo"]["seed"], ctx["year"], run])
    teams = [Team(i, spec, ctx) for i, spec in enumerate(ctx["teams"])]
    n = ctx["n_pool"]
    # How the whole room rates each player this run: one draw from the value model's own error,
    # shared by every team (each team's own noise comes on top, lot by lot).
    market = np.exp(A["market_share"] * ctx["value_sigma"] * rng.standard_normal(n))
    remaining, called = np.ones(n, bool), np.zeros(n, bool)
    records, willing, log, details = [], [], [], {}

    def lot(p: int, rnd: int) -> None:
        called[p] = True
        base = int(ctx["base"][p])
        noise = np.exp(A["noise_sigma"] * rng.standard_normal(len(teams)))
        sc = scarcity(ctx, teams, remaining, p)
        want = detail is not None and p in detail
        alike, _, short = market_for(ctx, teams, remaining, p) if want else (0, 0, 0)
        dec = [t.decide(p, sc, float(market[p]), float(noise[t.i]), want, p in shortlist[t.i]) for t in teams]
        events, walk = [], {}
        for t, d in zip(teams, dec):
            if d["open"]:
                walk[t.i] = min(d["walk"], d["cap"])
                events.append(["open", t.code, t.chip(p, p in shortlist[t.i])])
        for i, w in walk.items():
            if w < base:
                events.append(["drop", teams[i].code, base, f"Values him at {money(w)}"])
        able = {i: w for i, w in walk.items() if w >= base}
        willing.append(len(able))
        if not able:
            events.append(["unsold", "No bid at base"])
            records.append((p, UNSOLD, 0, rnd))
        else:
            win, price, run_up = settle(able, base)
            ladder, leaders = bid_sequence(able, base, win, price, run_up)
            out = set()
            for at, who in zip(ladder, leaders):
                events.append(["bid", teams[who].code, at])
                nxt = rules.next_bid(at)
                for i in sorted(able):
                    if i != who and i not in out and able[i] < nxt:
                        out.add(i)
                        d = dec[i]
                        why = (f"Purse limit {money(d['cap'])}" if d["walk"] > d["cap"]
                               else f"Walk-away {money(d['walk'])}")
                        events.append(["drop", teams[i].code, at, why])
            teams[win].buy(p, price)
            remaining[p] = False
            events.append(["sold", teams[win].code, price])
            records.append((p, win, price, rnd))
        log.append({"seq": len(records) - 1, "round": rnd, "player": ctx["names"][p], "events": events})
        if want:
            details.setdefault(p, []).append({
                "seq": len(records) - 1, "round": rnd, "start": base, "events": events,
                # comparable players of his role left besides him; teams that could buy him short of one
                "market": {"alike": alike - 1, "short": int(short)},
                "teams": {t.code: _decision(d) for t, d in zip(teams, dec)},
            })

    def nominate(pool: list[int], rnd: int) -> list[int]:
        """Players some team would bid for at base, before its own noise. In the last rounds each
        team with open slots also shortlists the best value for money left, one name per slot."""
        sc = {p: scarcity(ctx, teams, remaining, p) for p in pool}
        picked = set()
        for t in teams:
            if t.slots <= 0:
                continue
            scored = []
            for p in pool:
                d = t.decide(p, sc[p], float(market[p]), 1.0)
                if d["open"] and min(d["walk"], d["cap"]) >= ctx["base"][p]:
                    picked.add(p)
                if rnd == 2:
                    f = t.decide(p, sc[p], float(market[p]), 1.0, fill=True)
                    if f["open"]:
                        scored.append((-f["raw"] / ctx["base"][p], p))
            if rnd == 2:
                shortlist[t.i] = {p for _, p in sorted(scored)[: t.slots]}
                picked |= shortlist[t.i]
        return [p for p in pool if p in picked]

    shortlist: dict[int, set] = {t.i: set() for t in teams}
    order = np.lexsort((ctx["lot"], ctx["set"]))  # set order, list order within a set
    main = order[~ctx["accel"][order]]
    for s in sorted(set(ctx["set"][main])):  # set by set; names inside a set drawn at random
        for p in rng.permutation(main[ctx["set"][main] == s]):
            lot(int(p), 0)
    for p in nominate([int(p) for p in order if not called[p]], 1):
        lot(p, 1)
    while True:  # further rounds go on while franchises still fill their squads
        sold_before = sum(r[1] != UNSOLD for r in records)
        for p in nominate([int(p) for p in order if remaining[p]], 2):
            if all(t.slots == 0 for t in teams):
                break
            lot(p, 2)
        if sum(r[1] != UNSOLD for r in records) == sold_before:
            break
    for p in np.flatnonzero(~called):
        log.append({"seq": None, "round": None, "player": ctx["names"][p],
                    "events": [["unsold", "Not nominated"]]})
    return {"records": records, "willing": willing, "log": log, "details": details,
            "teams": [{"purse": t.purse, "bought": t.bought, "size": t.size} for t in teams]}


def _decision(d: dict) -> dict:
    f = d.get("f")
    return {
        "open": d["open"],
        "gate": [[k, ok, text] for k, ok, text in d["gate"]],
        "walk": round(min(d["walk"], d["cap"])) if f else None,
        "cap": d["cap"],
        "floor": d.get("floor"),
        "why": d.get("why"),
        "f": {k: round(v, 1 if k == "value" else 3) for k, v in f.items()} if f else None,
    }
