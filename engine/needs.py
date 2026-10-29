"""Team needs: the squad template, depth and upgrade gaps, lineup weaknesses and home fit.

A team's need for a player is the biggest gap he fills in his main or second role:
  depth gap   = share of the template's slots for that role still empty
  upgrade gap = how far he improves on the team's best in that role (standard deviations)
plus a keeper gap, and (with matchups) lineup weaknesses: a batting core that struggles
against a bowler type, or no left-arm pace in the attack.
"""
import numpy as np
import pandas as pd

from config import CFG
from pipeline import deliveries

N = CFG["needs"]
ROLES = ["pp_opener", "anchor", "finisher", "pp_pacer", "death_pacer",
         "wrist_spin", "finger_spin", "pace_ar", "spin_ar"]
LABELS = ["Powerplay opener", "Anchor", "Finisher", "Powerplay pacer", "Death pacer",
          "Wrist spinner", "Finger spinner", "Pace all-rounder", "Spin all-rounder"]
BAT, PACE, SPIN, AR = [0, 1, 2], [3, 4], [5, 6], [7, 8]
BATTING = BAT + AR  # roles that make a player part of the batting core
KINDS = ["depth", "upgrade", "keeper", "weakness"]


def template(skills: pd.DataFrame, asof: str) -> tuple[np.ndarray, float]:
    """Average role mix of IPL squads over recent seasons, scaled to a full squad; and keepers.
    Counted the way squads are counted: a main role in full, a second role at half weight."""
    d = deliveries.load()
    d = d[(d.comp == "IPL") & (d.date < asof)]
    last = d.date.dt.year.max()
    d = d[d.date.dt.year > last - N["template_seasons"]]
    season = d.date.dt.year
    bat = pd.DataFrame({"team": d.team_bat, "season": season, "pid": d.batter})
    ns = pd.DataFrame({"team": d.team_bat, "season": season, "pid": d.non_striker})
    bowl = pd.DataFrame({"team": d.team_bowl, "season": season, "pid": d.bowler})
    squads = pd.concat([bat, ns, bowl]).astype({"pid": object, "team": object}).drop_duplicates()
    squads = squads.join(skills[["role", "role2", "keeper"]], on="pid").dropna(subset=["role"])
    main = squads.groupby(["team", "season"]).role.value_counts().unstack(fill_value=0)
    second = squads.dropna(subset=["role2"]).groupby(["team", "season"]).role2.value_counts().unstack(fill_value=0)
    counts = main.reindex(columns=ROLES, fill_value=0).add(
        N["second_role"] * second.reindex(index=main.index, columns=ROLES, fill_value=0), fill_value=0)
    scale = CFG["rules"]["max_squad"] / squads.groupby(["team", "season"]).size().mean()
    keepers = squads.groupby(["team", "season"]).keeper.sum().mean() * scale
    return (counts.mean() * scale).to_numpy(), float(keepers)


class Squad:
    """One team's squad, kept as the numbers its need calculation uses."""

    def __init__(self, members: list[int], P: dict, tmpl: np.ndarray, keep_tmpl: float, factors: set):
        self.P, self.tmpl, self.keep_tmpl, self.factors = P, tmpl, keep_tmpl, factors
        self.members = []
        self.counts = np.zeros(len(ROLES))
        self.best = np.full(len(ROLES), -3.0)
        self.keepers = self.lap = 0
        for m in members:
            self.add(m)

    def add(self, p: int) -> None:
        P = self.P
        self.members.append(p)
        self.counts += P["A"][p]
        has = P["A"][p] > 0
        self.best[has] = np.maximum(self.best[has], P["Q"][p, has])
        self.keepers += P["keeper"][p]
        self.lap += P["lap"][p]

    def weakness(self) -> np.ndarray:
        """Batting core's average shortfall against each bowler type (negative = weak)."""
        P = self.P
        core = [m for m in self.members if P["batter"][m]]
        core = sorted(core, key=lambda m: -P["bat_z"][m])[: N["core"]]
        return P["delta"][core].mean(axis=0) if core else np.zeros(P["delta"].shape[1])

    def needs(self, cand: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Need score for every candidate, with the role and kind of gap that drives it."""
        P = self.P
        A, Q = P["A"][cand], P["Q"][cand]
        depth = np.clip(self.tmpl - self.counts, 0, None) / self.tmpl
        upgrade = np.clip(Q - self.best, 0, N["upgrade_cap"]) / N["upgrade_cap"]
        role_need = (depth + N["upgrade_weight"] * upgrade) * np.where(A > 0, A, 0)
        role = role_need.argmax(axis=1)
        rows = np.arange(len(cand))
        score = role_need[rows, role]
        kind = np.where(depth[role] * A[rows, role] >= score / 2, 0, 1)

        keep_gap = max(0.0, self.keep_tmpl - self.keepers) / self.keep_tmpl
        keep = N["keeper_weight"] * keep_gap * P["keeper"][cand]
        kind = np.where(keep > score, 2, kind)
        score = np.maximum(score, keep)

        if "matchups" in self.factors:
            weak = np.clip(-self.weakness() / N["weakness_cap"], 0, 1)
            fit = (weak * np.clip(P["delta"][cand], 0, 1)).max(axis=1) * P["batter"][cand]
            lap = P["lap"][cand] * (self.lap == 0)
            bonus = N["matchup_weight"] * np.maximum(fit, lap)
            kind = np.where(bonus > score / 2, 3, kind)
            score = score + bonus
        return score, role, kind


def home_fit(P: dict, spin_edge: float, main: np.ndarray) -> np.ndarray:
    """How well each player suits a team's home grounds, in [-cap, cap]."""
    a = CFG["agents"]
    edge = spin_edge * a["home_scale"]
    bowl = np.where(np.isin(main, SPIN + [8]), edge, np.where(np.isin(main, PACE + [7]), -edge, 0.0))
    bat = edge * np.clip(P["spin_bias"], -1, 1)
    fit = np.where(np.isin(main, BAT), bat, np.where(np.isin(main, AR), (bat + bowl) / 2, bowl))
    return np.clip(fit, -a["home_fit_cap"], a["home_fit_cap"])
