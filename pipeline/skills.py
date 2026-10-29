"""Player skills as of a date, from ball-by-ball data only.

Quality is runs added per ball: the runs a ball produced plus the change in run expectancy,
so a wicket costs what it costs at that point of the innings. Each ball is compared with the
average for the same phase at the same venue in the same competition-season (park factors),
adjusted for league strength, weighted toward recent seasons and shrunk toward average when
the evidence is thin. Roles come from usage; tags record matchups against six bowler types,
start speed, keeper, left-handed bat and left-arm pace.

    python -m pipeline.skills 2025-12-16
"""
import sys

import numpy as np
import pandas as pd

from config import CFG, ROOT
from pipeline import deliveries, venues

S, R = CFG["skills"], CFG["roles"]
PHASE_OF_OVER = np.array([0] * 6 + [1] * 9 + [2] * 5, dtype=np.int8)
BOWL_TYPES = ["ra_pace", "la_pace", "off_spin", "la_orth", "leg_spin", "la_wrist"]
SPIN = {"off_spin", "la_orth", "leg_spin", "la_wrist"}
BAT_ROLES = ("pp_opener", "anchor", "finisher")
ROLE_GROUPS = {"bat": BAT_ROLES + ("pace_ar", "spin_ar"),  # who a skill is compared with
               "bowl": ("pp_pacer", "death_pacer", "wrist_spin", "finger_spin", "pace_ar", "spin_ar")}


def bowl_type(style) -> str | None:
    """Bowler type from a style string (cricinfo's "Legbreak googly" or the auction list's
    "RIGHT ARM Leg Spin")."""
    s = str(style).lower().split(",")[0]
    if "wrist" in s or "chinaman" in s or "unorthodox" in s:
        return "la_wrist"
    if any(k in s for k in ("legbreak", "leg break", "leg spin")):
        return "leg_spin"
    if any(k in s for k in ("offbreak", "off break", "off spin")):
        return "off_spin"
    if "orthodox" in s:
        return "la_orth"
    if "medium" in s or "fast" in s:
        return "la_pace" if s.startswith("left") else "ra_pace"
    return None


def load_meta() -> pd.DataFrame:
    m = pd.read_csv(ROOT / "data" / "player_meta.csv", dtype=str).apply(lambda c: c.str.strip())
    m = m.dropna(subset=["cricsheet_id"]).drop_duplicates("cricsheet_id").set_index("cricsheet_id")
    m["bowl_type"] = m.bowling_style.map(bowl_type)
    return m


def decreasing(y: np.ndarray, w: np.ndarray) -> np.ndarray:
    """Weighted least-squares fit of y that never increases (pool adjacent violators)."""
    blocks = []  # [weighted mean, weight, length]
    for yi, wi in zip(y, w):
        blocks.append([yi, wi, 1])
        while len(blocks) > 1 and blocks[-2][0] < blocks[-1][0]:
            m2, w2, n2 = blocks.pop()
            m1, w1, n1 = blocks.pop()
            blocks.append([(m1 * w1 + m2 * w2) / (w1 + w2), w1 + w2, n1 + n2])
    return np.concatenate([[m] * n for m, _, n in blocks])


def run_expectancy(d: pd.DataFrame) -> np.ndarray:
    """RE[legal balls bowled, wickets down] = runs still to come in an IPL first innings.

    Recency-weighted IPL first innings, cell by cell, smoothed over neighbouring balls and shrunk
    toward a fitted curve per wickets-down, Z·(1 − exp(−balls left / L)) (the shape behind the DLS
    resource table), so thin cells lean on the curve. At every ball, more wickets down can never
    mean more runs to come: a weighted isotonic fit across wickets enforces it, and runs to come
    never rise as balls are bowled.
    """
    first = d[(d.comp == "IPL") & (d.inn == 1)]
    total = first.groupby("mid").r_total.transform("sum")
    before = first.groupby("mid").r_total.cumsum() - first.r_total
    s = (first.assign(y=total - before, u=120 - first.legal_before)
              .drop_duplicates(["mid", "legal_before"]))
    cells = s.assign(wy=s.w * s.y).groupby(["wkts_before", "u"]).agg(wy=("wy", "sum"), w=("w", "sum"))
    wy, wt = np.zeros((121, 11)), np.zeros((121, 11))
    for (wk, u), r in cells.iterrows():
        if wk < 10:
            wy[120 - u, wk], wt[120 - u, wk] = r.wy, r.w
    left = 120 - np.arange(121)
    curve = np.zeros((121, 11))
    for wk in range(10):
        c = cells.loc[wk]
        u, y, n = c.index.to_numpy(), (c.wy / c.w).to_numpy(), c.w.to_numpy()
        fits = []
        for scale in np.arange(10, 800, 2):
            shape = 1 - np.exp(-u / scale)
            z = (n * y * shape).sum() / (n * shape * shape).sum()
            fits.append(((n * (y - z * shape) ** 2).sum(), z, scale))
        _, z, scale = min(fits)
        curve[:, wk] = z * (1 - np.exp(-left / scale))
    window = np.ones(2 * S["re_window"] + 1)
    smooth = lambda m: np.stack([np.convolve(m[:, j], window, mode="same") for j in range(11)], axis=1)
    wy, wt = smooth(wy), smooth(wt)
    curve = np.minimum.accumulate(np.array([decreasing(curve[b], wt[b] + 1e-3) for b in range(121)]), axis=0)
    k = S["re_prior"]
    target = (wy + k * curve) / (wt + k)
    re = np.array([decreasing(target[b], wt[b] + k) for b in range(121)])
    re[:, 10] = 0
    re[120] = 0
    return np.minimum.accumulate(re, axis=0)


def prepare(d: pd.DataFrame, meta: pd.DataFrame, asof: str) -> pd.DataFrame:
    """Deliveries before `asof` with recency weights, run values and context columns."""
    d = d[d.date < asof].copy()
    d["w"] = 0.5 ** ((pd.Timestamp(asof) - d.date).dt.days.to_numpy() / S["half_life_days"])
    re = run_expectancy(d)
    d["phase"] = PHASE_OF_OVER[d.over.clip(0, 19).to_numpy()]
    d["year"] = d.date.dt.year.astype(np.int16)
    d["venue_c"] = d.venue.map(venues.canon).astype("category")
    d["legal"] = (d.wide == 0) & (d.noball == 0)
    d["faced"] = d.wide == 0
    out = d.out_id.astype(object)
    d["bat_out"] = (out == d.batter.astype(object)).to_numpy()
    d["bowler_wkt"] = d.kind.isin(venues.WICKET_KINDS).to_numpy()
    d["conceded"] = d.r_bat + d.wide + d.noball
    d["boundary"] = d.r_bat.isin((4, 6)) & d.faced
    b0 = d.legal_before.clip(upper=120).to_numpy()
    w0 = d.wkts_before.clip(upper=10).to_numpy()
    b1 = np.minimum(b0 + d.legal.to_numpy(), 120)
    re0 = re[b0, w0]
    d["rv_bat"] = d.r_bat + re[b1, np.minimum(w0 + d.bat_out, 10)] - re0
    d["rv_bowl"] = -(d.conceded + re[b1, np.minimum(w0 + d.bowler_wkt, 10)] - re0)
    d["btype"] = d.bowler.astype(object).map(meta.bowl_type).astype("category")
    d["is_spin"] = d.btype.isin(SPIN).to_numpy()
    return d


def contextualise(d: pd.DataFrame, col: str, mask: pd.Series) -> np.ndarray:
    """col minus its average for the same competition-season-phase and (shrunk) venue-phase."""
    x = d.loc[mask, ["comp", "year", "phase", "venue_c", col]]
    resid = x[col] - x.groupby(["comp", "year", "phase"], observed=True)[col].transform("mean")
    g = resid.groupby([x.venue_c, x.phase], observed=True)
    park = g.transform("sum") / (g.transform("size") + S["venue_prior_balls"])
    out = np.full(len(d), np.nan)
    out[mask.to_numpy()] = (resid - park).to_numpy()
    return out


def league_offsets(d: pd.DataFrame, who: str, adj: str, mask: pd.Series) -> pd.Series:
    """Per competition: how much easier it is than the IPL, from players who played both."""
    x = d.loc[mask]
    g = (x.assign(wa=x.w * x[adj])
          .groupby([who, "comp"], observed=True)
          .agg(wa=("wa", "sum"), w=("w", "sum"), n=(adj, "size")))
    g = g[g.n >= S["league_min_balls"]]
    g["m"] = g.wa / g.w
    wide = g.m.unstack("comp")
    eff = g.w.unstack("comp")
    raw = {}
    for comp in wide.columns.drop("IPL", errors="ignore"):
        both = wide[[comp, "IPL"]].dropna().index
        h = 2 / (1 / eff.loc[both, comp] + 1 / eff.loc[both, "IPL"])
        raw[comp] = ((wide.loc[both, comp] - wide.loc[both, "IPL"]) * h).sum(), h.sum()
    pooled = sum(v[0] for v in raw.values()) / sum(v[1] for v in raw.values())
    off = {c: (s + S["league_prior_balls"] * pooled) / (h + S["league_prior_balls"])
           for c, (s, h) in raw.items()}
    off["IPL"] = 0.0
    return pd.Series(off)


def shrink_prior(per_ball: pd.Series, who: pd.Series) -> float:
    """Prior strength k (in balls) = within-player variance / between-player variance."""
    g = per_ball.groupby(who, observed=True).agg(["mean", "var", "size"])
    big = g[g["size"] >= S["k_min_balls"]]
    sigma2 = per_ball.var()
    tau2 = max(big["mean"].var() - (sigma2 / big["size"]).mean(), 1e-6)
    return float(sigma2 / tau2)


def quality(d: pd.DataFrame, who: str, adj: str, mask: pd.Series, k: float) -> pd.DataFrame:
    """Shrunk mean per player: k balls of the population average are added to his own."""
    x = d.loc[mask]
    g = (x.assign(wa=x.w * x[adj])
          .groupby(who, observed=True)
          .agg(wa=("wa", "sum"), w=("w", "sum"), balls=(adj, "size")))
    mu = g.wa.sum() / g.w.sum()
    return pd.DataFrame({"q": (g.wa + k * mu) / (g.w + k), "balls": g.balls})


def phase_shares(d: pd.DataFrame, who: str, mask: pd.Series) -> pd.DataFrame:
    x = d.loc[mask]
    s = x.groupby([who, "phase"], observed=True).w.sum().unstack(fill_value=0)
    return s.div(s.sum(axis=1), axis=0).rename(columns={0: "pp", 1: "mid", 2: "death"})


def start_speed(d: pd.DataFrame) -> pd.DataFrame:
    """Runs per ball above expectation in a batter's first balls, given the phase he came in,
    league-adjusted and shrunk on its own scale."""
    x = d[d.faced & (d.bat_ball <= S["start_balls"])]
    came_in = x.groupby(["mid", "inn", "batter"], observed=True).phase.transform("first")
    x = x.assign(came_in=came_in)
    exp = x.groupby(["comp", "year", "came_in"], observed=True).r_bat.transform("mean")
    x = x.assign(adj=x.r_bat - exp)
    every = pd.Series(True, index=x.index)
    x["adj"] -= x.comp.map(league_offsets(x, "batter", "adj", every)).astype(float)
    return quality(x, "batter", "adj", every, shrink_prior(x.adj, x.batter))


def matchups(d: pd.DataFrame, bat: pd.DataFrame, k: float) -> pd.DataFrame:
    """Batter quality against each bowler type, shrunk toward his own overall quality."""
    x = d[d.faced & d.btype.notna()]
    g = (x.assign(wa=x.w * x.bat_adj)
          .groupby(["batter", "btype"], observed=True)
          .agg(wa=("wa", "sum"), w=("w", "sum"), balls=("bat_adj", "size")))
    prior = bat.q.reindex(g.index.get_level_values(0)).fillna(0).to_numpy()
    g["q"] = (g.wa + k * prior) / (g.w + k)
    q = g.q.unstack().reindex(columns=BOWL_TYPES)
    n = g.balls.unstack().reindex(columns=BOWL_TYPES).fillna(0).astype(int)
    return q.add_prefix("vs_").join(n.add_prefix("vsn_"))


def assign_roles(p: pd.DataFrame, meta: pd.DataFrame) -> pd.DataFrame:
    """Main and second role from usage: phase shares, batting position, balls per match."""
    btype = meta.bowl_type.reindex(p.index)
    spin = btype.isin(SPIN)
    bowls = p.bowl_rate >= R["bowler_balls_per_match"]
    bats = (p.bat_rate >= R["batter_balls_per_match"]) & (p.avg_pos <= R["max_bat_pos"])

    def bat_role(r):
        if r.bat_pp >= R["opener_pp_share"]:
            return "pp_opener"
        hitter = r.avg_pos >= R["finisher_min_pos"] and r.bat_sr >= R["finisher_min_sr"]
        return "finisher" if r.bat_death >= R["finisher_death_share"] or hitter else "anchor"

    def bowl_role(r, is_spin, t):
        if is_spin:
            return "wrist_spin" if t in ("leg_spin", "la_wrist") else "finger_spin"
        return "death_pacer" if r.bowl_death >= r.bowl_pp else "pp_pacer"

    main, second = [], []
    for pid, r in p.iterrows():
        is_spin, t = bool(spin.get(pid, False)), btype.get(pid)
        if bowls[pid] and bats[pid]:
            main.append("spin_ar" if is_spin else "pace_ar")
            second.append(bat_role(r) if r.bat_rate >= R["ar_bat_balls_per_match"] else bowl_role(r, is_spin, t))
        elif bowls[pid]:
            role = bowl_role(r, is_spin, t)
            main.append(role)
            other = ("pp_pacer" if role == "death_pacer" else "death_pacer") if not is_spin else None
            share = r.bowl_pp if other == "pp_pacer" else r.bowl_death
            second.append(other if other and share >= R["second_role_share"] else None)
        elif bats[pid] or r.bat_balls >= R["min_balls"]:
            role = bat_role(r)
            main.append(role)
            alt = {"pp_opener": r.bat_mid + r.bat_death, "anchor": max(r.bat_pp, r.bat_death),
                   "finisher": r.bat_mid}[role]
            if p.at[pid, "bowl_rate"] >= R["bowler_balls_per_match"] / 2:
                second.append("spin_ar" if is_spin else "pace_ar")
            elif alt >= R["second_role_share"]:
                second.append("anchor" if role != "anchor" else
                              ("pp_opener" if r.bat_pp >= r.bat_death else "finisher"))
            else:
                second.append(None)
        else:
            main.append(None)
            second.append(None)
    return pd.DataFrame({"role": main, "role2": second}, index=p.index)


def build(asof: str) -> pd.DataFrame:
    meta = load_meta()
    d = prepare(deliveries.load(), meta, asof)
    faced, bowled = d.faced, pd.Series(True, index=d.index)

    d["bat_adj"] = contextualise(d, "rv_bat", faced)
    d["bowl_adj"] = contextualise(d, "rv_bowl", bowled)
    off_bat = league_offsets(d, "batter", "bat_adj", faced)
    off_bowl = league_offsets(d, "bowler", "bowl_adj", bowled)
    d["bat_adj"] -= d.comp.map(off_bat).astype(float)
    d["bowl_adj"] -= d.comp.map(off_bowl).astype(float)

    k_bat = shrink_prior(d.loc[faced, "bat_adj"], d.loc[faced, "batter"])
    k_bowl = shrink_prior(d.bowl_adj, d.bowler)
    bat = quality(d, "batter", "bat_adj", faced, k_bat).add_prefix("bat_")
    bowl = quality(d, "bowler", "bowl_adj", bowled, k_bowl).add_prefix("bowl_")
    start = start_speed(d).add_prefix("start_")
    vs = matchups(d, bat.rename(columns=lambda c: c[4:]), k_bat)

    # usage
    apps = pd.concat([d[["mid", "w", c]].rename(columns={c: "pid"}) for c in ("batter", "non_striker", "bowler")])
    apps = apps.astype({"pid": object}).drop_duplicates(["mid", "pid"])
    games = apps.groupby("pid").agg(matches=("mid", "size"), wm=("w", "sum"))
    ipl = d[d.comp == "IPL"]
    ipl_apps = apps[apps.mid.isin(ipl.mid.unique())]
    games["ipl_matches"] = ipl_apps.groupby("pid").size()

    bshare = phase_shares(d, "batter", faced).add_prefix("bat_")
    wshare = phase_shares(d, "bowler", bowled).add_prefix("bowl_")
    pos = d[d.bat_ball == 1].groupby("batter", observed=True).bat_pos.mean().rename("avg_pos")
    bat_w = d[faced].groupby("batter", observed=True).w.sum()
    bowl_w = d[d.legal].groupby("bowler", observed=True).w.sum()
    rates = pd.DataFrame({"bat_rate": bat_w / games.wm, "bowl_rate": bowl_w / games.wm})
    rates.index = rates.index.astype(object)

    x = d[faced].groupby("batter", observed=True).agg(runs=("r_bat", "sum"), balls=("r_bat", "size"))
    y = d.groupby("bowler", observed=True).agg(conc=("conceded", "sum"), legal=("legal", "sum"))
    p = (games.join([bat, bowl, start, vs, bshare, wshare, pos, rates], how="left")
              .assign(bat_sr=100 * x.runs / x.balls, bowl_econ=6 * y.conc / y.legal))
    p.index.name = "cricsheet_id"
    for c in ("bat_balls", "bowl_balls", "start_balls", "ipl_matches"):
        p[c] = p[c].fillna(0).astype(int)
    p[["bat_pp", "bat_mid", "bat_death", "bowl_pp", "bowl_mid", "bowl_death", "bat_rate", "bowl_rate"]] = \
        p[["bat_pp", "bat_mid", "bat_death", "bowl_pp", "bowl_mid", "bowl_death", "bat_rate", "bowl_rate"]].fillna(0)
    p["avg_pos"] = p.avg_pos.fillna(11)
    p = p.join(assign_roles(p, meta))

    m = meta.reindex(p.index)
    p["bowl_type"] = m.bowl_type
    p["lhb"] = m.batting_style.str.startswith("Left", na=False)
    p["keeper"] = m.playing_role.str.contains("Wicketkeeper", na=False)
    for side, roles in ROLE_GROUPS.items():  # percentile within the role group: batters, or bowlers
        member = p.role.isin(roles) | p.role2.isin(roles)
        ref = p.loc[member & (p[f"{side}_balls"] >= S["pct_min_balls"]), f"{side}_q"].sort_values().to_numpy()
        pct = np.round(100 * np.searchsorted(ref, p[f"{side}_q"].fillna(-np.inf)) / len(ref))
        p[f"{side}_pct"] = np.where(p[f"{side}_balls"] >= R["min_balls"], pct, np.nan)
    p.attrs.update(k_bat=k_bat, k_bowl=k_bowl, off_bat=off_bat.to_dict(), off_bowl=off_bowl.to_dict())
    return p.drop(columns=["wm", "bowl_mid"])


def venue_table(asof: str) -> tuple[pd.DataFrame, dict]:
    """IPL ground profiles and team home grounds as of `asof`."""
    meta = load_meta()
    d = prepare(deliveries.load(), meta, asof)
    ipl = d[d.comp == "IPL"]
    prof = venues.profiles(ipl, ipl.w.to_numpy())
    return prof, venues.home_grounds(ipl, prof, asof)


if __name__ == "__main__":
    asof = sys.argv[1] if len(sys.argv) > 1 else CFG["data"]["cutoff"]
    out = ROOT / "pipeline" / "out"
    out.mkdir(exist_ok=True)
    skills = build(asof)
    skills.to_csv(out / f"skills_{asof}.csv", float_format="%.4f")
    print(f"{len(skills):,} players as of {asof}; k_bat={skills.attrs['k_bat']:.0f} "
          f"k_bowl={skills.attrs['k_bowl']:.0f}")
    print("league offsets (bat):", {k: round(v, 3) for k, v in skills.attrs["off_bat"].items()})
    print("league offsets (bowl):", {k: round(v, 3) for k, v in skills.attrs["off_bowl"].items()})
    print(skills.role.value_counts(dropna=False).to_string())
