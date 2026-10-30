"""Everything one simulated auction needs, assembled from pipeline outputs: the pool in list
order with roles, standardised skills and model values; the ten teams with their squads,
purses, home grounds and spending styles; and the squad template.

Only information dated before the auction is used: skills as of the auction day, the value
model and team styles fitted on earlier auctions only.
"""
from functools import lru_cache

import numpy as np
import pandas as pd

from analysis.value_model import ValueModel, features
from config import CFG, ROOT
from engine import needs
from pipeline import register, skills as sk

AUC = ROOT / "data" / "auctions"
OUT = ROOT / "pipeline" / "out"
TEAMS = ["CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RCB", "RR", "SRH"]
NE, A, R, S = CFG["needs"], CFG["agents"], CFG["roles"], CFG["skills"]
Q_COLS = [f"q_{r}" for r in needs.ROLES]  # role-quality matrix, one column per role
LISTED = {"Bowler": "BOWLER", "Allrounder": "ALL-ROUNDER", "Bowling Allrounder": "ALL-ROUNDER",
          "Batting Allrounder": "ALL-ROUNDER", "Wicketkeeper Batter": "WICKETKEEPER",
          "Wicketkeeper": "WICKETKEEPER"}


def first(*series: pd.Series) -> pd.Series:
    """Element-wise first non-missing value across aligned series."""
    out = series[0].astype(object)
    for s in series[1:]:
        out = out.where(out.notna(), s.astype(object))
    return out


def date_of(year: int) -> str:
    return CFG["auction"][str(year)]["date"]


def cricsheet_ids(df: pd.DataFrame, tag: str) -> pd.Series:
    """Cricsheet id per row; date of birth (or team, for retained squads) tells namesakes apart."""
    ids = register.load_name_map()
    blank = pd.Series("", index=df.index)
    dob = df.get("dob", blank).fillna("").astype(str)
    team = df.get("team", blank).fillna("").astype(str)
    return pd.Series([register.lookup(n, d, tag, t, ids) for n, d, t in zip(df.name, dob, team)],
                     index=df.index, dtype=object)


@lru_cache(maxsize=None)
def skills_asof(asof: str) -> pd.DataFrame:
    path = OUT / f"skills_{asof}.csv"
    if not path.exists():
        OUT.mkdir(exist_ok=True)
        sk.build(asof).to_csv(path, float_format="%.5f")
    return pd.read_csv(path, index_col=0, dtype={"role": object, "role2": object})


def auction_list(year: int) -> pd.DataFrame:
    """The auction list for a year (results columns kept only for past auctions)."""
    tag = "pool_2026" if year == 2026 else f"auction_{year}"
    df = pd.read_csv(AUC / f"{tag}.csv")
    df["cid"] = cricsheet_ids(df, tag)
    return df


def market(year: int) -> float:
    """Money per open slot (lakhs) across the ten teams before the auction."""
    m = pd.read_csv(AUC / "markets.csv").set_index("year")
    return float(m.at[year, "total_purse_lakh"] / m.at[year, "total_slots"])


def prev_prices(year: int) -> pd.DataFrame:
    """Each player's most recent IPL auction price before `year`, from every earlier auction on file."""
    rows = []
    for y in range(min(map(int, CFG["auction"])), year):
        path = AUC / f"auction_{y}.csv"
        if path.exists():
            a = pd.read_csv(path)
            if "status" in a:
                a = a[a.status.eq("sold")]
            rows.append(a.assign(year=y, cid=cricsheet_ids(a, f"auction_{y}"))[["name", "team", "price_lakh", "year", "cid"]])
    p = pd.concat(rows) if rows else pd.DataFrame(columns=["name", "team", "price_lakh", "year", "cid"])
    p["key"] = p.cid.fillna(p.name)
    return p.sort_values("year").groupby("key").last()


def profile(df: pd.DataFrame, asof: str, factors: set) -> pd.DataFrame:
    """Roles, standardised skills and tags. df: name, cid, and optionally role (as listed),
    batting_style, bowling_style, dob or age."""
    s = skills_asof(asof)
    meta = sk.load_meta()
    x = df.assign(cid=df.cid.astype(object)).join(
        s.rename(columns={"role": "use_role", "role2": "use_role2"}), on="cid")
    m = meta.reindex(x.cid)
    m.index = x.index

    def zscore(col: str, balls: str, min_balls: int) -> pd.Series:
        reg = s.loc[s[balls] >= min_balls, col]
        thin = s.loc[s[balls] < R["min_balls"], col].median()
        return (x[col].fillna(thin) - reg.mean()) / reg.std()

    x["bat_z"] = zscore("bat_q", "bat_balls", S["pct_min_balls"])
    x["bowl_z"] = zscore("bowl_q", "bowl_balls", S["pct_min_balls"])
    x["start_z"] = zscore("start_q", "start_balls", S["z_min_balls"]).where(x.start_q.notna(), 0.0)
    for t in sk.BOWL_TYPES:
        diff = s[f"vs_{t}"] - s.bat_q
        sd = diff[s[f"vsn_{t}"] >= S["z_min_balls"]].std()
        x[f"d_{t}"] = ((x[f"vs_{t}"] - x.bat_q) / sd).fillna(0.0)
    spin_t = [f"d_{t}" for t in sk.BOWL_TYPES if t in sk.SPIN]
    pace_t = [f"d_{t}" for t in sk.BOWL_TYPES if t not in sk.SPIN]
    x["spin_bias"] = x[spin_t].mean(axis=1) - x[pace_t].mean(axis=1)

    none = pd.Series(None, index=x.index, dtype=object)
    style = x.get("bowling_style", none).map(sk.bowl_type)
    x["bowl_type"] = first(x.bowl_type, m.bowl_type, style)
    meta_role = m.playing_role.map(lambda r: LISTED.get(r, "BATTER") if isinstance(r, str) else None)
    listed = first(x.get("role", none), meta_role)
    thin = (x.bat_balls.fillna(0) + x.bowl_balls.fillna(0)) < R["min_balls"]
    fallback = [_listed_role(l, t) for l, t in zip(listed, x.bowl_type)]
    x["role_main"] = np.where(thin | x.use_role.isna(), fallback, x.use_role)
    x["role_second"] = np.where(thin, None, x.use_role2)
    x["keeper"] = x.keeper.eq(True) | listed.eq("WICKETKEEPER")
    x["lhb"] = x.lhb.eq(True) | x.get("batting_style", none).astype(str).str.startswith(("L", "Left"))
    x["lap"] = x.bowl_type.eq("la_pace")
    for c in ("bat_balls", "bowl_balls", "start_balls", "ipl_matches", "matches"):
        x[c] = x[c].fillna(0).astype(int)
    dob = pd.to_datetime(first(x.get("dob", none), m.dob), errors="coerce")
    x["age"] = ((pd.Timestamp(asof) - dob).dt.days / 365.25).round(1)
    if "age" in df:
        x["age"] = x.age.fillna(df.age)

    ridx = {r: i for i, r in enumerate(needs.ROLES)}
    main = x.role_main.map(ridx).to_numpy()
    second = x.role_second.map(ridx)
    Q = np.empty((len(x), len(needs.ROLES)))
    Q[:, needs.BAT] = x.bat_z.to_numpy()[:, None]
    if "start_speed" in factors:  # openers and finishers are judged partly on how fast they start
        Q[:, [0, 2]] += NE["start_weight"] * x.start_z.to_numpy()[:, None]
    Q[:, needs.PACE + needs.SPIN] = x.bowl_z.to_numpy()[:, None]
    Q[:, needs.AR] = ((x.bat_z + x.bowl_z) / np.sqrt(2)).to_numpy()[:, None]
    x["main"] = main
    x["second"] = second.fillna(-1).astype(int).to_numpy()
    x["skill_z"] = Q[np.arange(len(x)), main]
    return x.join(pd.DataFrame(Q, index=x.index, columns=Q_COLS))


def _listed_role(listed, btype) -> str:
    spin = btype in sk.SPIN
    if listed == "BOWLER":
        if spin:
            return "wrist_spin" if btype in ("leg_spin", "la_wrist") else "finger_spin"
        return "pp_pacer"
    if listed == "ALL-ROUNDER":
        return "spin_ar" if spin else "pace_ar"
    return "anchor"


def value_frame(df: pd.DataFrame, year: int, factors: set) -> pd.DataFrame:
    """Value-model features for an auction list already run through profile()."""
    prev = prev_prices(year)
    key = df.cid.fillna(df.name)
    pp = prev.price_lakh.reindex(key).to_numpy(float)
    main = df.main.to_numpy()
    out = pd.DataFrame(index=df.index)
    out["log_base"] = np.log(df.base_lakh)
    out["has_prev"] = ~np.isnan(pp)
    out["log_prev"] = np.where(np.isnan(pp), 0.0, np.log(np.where(np.isnan(pp), 1, pp)))
    out["overseas"] = df.overseas.astype(float)
    out["capped"] = df.capped.astype(str).str.lower().eq("capped").astype(float)
    age = df.age.fillna(df.age.median()).fillna(0)  # unknown age -> list median
    out["age"] = age
    out["age2"] = (age - age.median()) ** 2
    out["pace"] = np.isin(main, needs.PACE)
    out["spin"] = np.isin(main, needs.SPIN)
    out["allround"] = np.isin(main, needs.AR)
    out["keeper"] = df.keeper
    out["skill_z"] = df.skill_z
    bowl_side = np.isin(main, needs.PACE + needs.SPIN)
    ar = np.isin(main, needs.AR)
    balls = np.where(bowl_side, df.bowl_balls, np.where(ar, df.bat_balls + df.bowl_balls, df.bat_balls))
    out["evidence"] = np.log1p(balls)
    # pedigree, as printed on the official auction list: international caps and career IPL caps
    caps = [c for c in ("test_caps", "odi_caps", "t20i_caps") if c in df]
    out["intl_caps"] = np.log1p(df[caps].fillna(0).sum(axis=1)) if caps else 0.0
    ipl = df.ipl_caps.fillna(df.ipl_matches) if "ipl_caps" in df else df.ipl_matches
    out["ipl_exp"] = np.log1p(ipl)
    out["start_z"] = np.where(np.isin(main, needs.BAT + needs.AR), df.start_z, 0.0)
    # how far down the official list his set comes (published a week before): sets are called in
    # list order, and after the first few only the players a franchise asks for are called
    setn = df.set_no.fillna(df.set_no.max() + 1)  # late additions without a set come last
    out["set_pos"] = setn / setn.max()
    out["prev_price"] = pp
    return out.astype({c: float for c in out.columns})


def training(years: list[int], factors: set) -> pd.DataFrame:
    frames = []
    for y in years:
        a = auction_list(y)
        prof = profile(a, date_of(y), factors)
        f = value_frame(prof, y, factors)
        mps = np.log(market(y))
        sold = a.status.eq("sold").to_numpy()
        f["y"] = np.where(sold, np.log(a.price_lakh.where(sold, 1)), np.log(a.base_lakh)) - mps
        f["sold"] = sold
        f["team"] = a.team.where(sold)
        f["year"] = y
        frames.append(f)
    return pd.concat(frames, ignore_index=True)


def fit_value(year: int, factors: set, ridge: float | None = None) -> tuple[ValueModel, pd.DataFrame]:
    """Fitted on the earlier auctions of the same kind (config `train`): mega and mini auctions
    price players differently, so they are never mixed."""
    train = training(CFG["auction"][str(year)]["train"], factors)
    model = ValueModel(features(factors), CFG["value"]["ridge"] if ridge is None else ridge).fit(train)
    return model, train


def team_styles(model: ValueModel, train: pd.DataFrame) -> dict[str, float]:
    """How much more (or less) than the average buyer each team paid in earlier auctions,
    against model value, shrunk. (Every buyer pays above the model's mean - that is why the
    player sold - so residuals are compared with the average buyer's, not with zero.)"""
    sold = train[train.sold].copy()
    sold["resid"] = sold.y - model.predict(sold, 0).value_mu
    sold["resid"] -= sold.resid.mean()
    g = sold.groupby("team").resid.agg(["sum", "size"])
    style = np.exp(g["sum"] / (g["size"] + A["style_prior"]))
    lo, hi = A["style_range"]
    return {t: float(np.clip(style.get(t, 1.0), lo, hi)) for t in TEAMS}


def build(year: int, factors: set, mode: str = "value", ridge: float | None = None) -> dict:
    """The simulation context for one auction."""
    from pipeline.skills import venue_table

    asof = date_of(year)
    CFG["rules"].update(CFG["auction"][str(year)].get("rules", {}))
    model, train = fit_value(year, factors, ridge)
    pool = auction_list(year)
    pool = pool.sort_values("lot_no", kind="stable").reset_index(drop=True)
    pool["lot"] = np.arange(1, len(pool) + 1)  # call order; list numbers decide the accelerated rounds
    pool["set_no"] = pool.set_no.fillna(pool.set_no.max() + 1)  # late additions without a set come last
    prof = profile(pool, asof, factors)
    vf = value_frame(prof, year, factors)
    vals = model.predict(vf, np.log(market(year)))
    styles = team_styles(model, train)

    teams = pd.read_csv(AUC / f"teams_{year}.csv").set_index("team").loc[TEAMS]
    ret = pd.read_csv(AUC / f"retained_{year}.csv")
    ret["cid"] = cricsheet_ids(ret, f"retained_{year}")
    rprof = profile(ret, asof, factors)
    allp = pd.concat([prof, rprof], ignore_index=True)
    Q = allp[Q_COLS].to_numpy()
    n = len(prof)
    Amat = np.zeros_like(Q)
    Amat[np.arange(len(allp)), allp.main.to_numpy()] = 1.0
    has2 = allp.second.to_numpy() >= 0
    Amat[np.flatnonzero(has2), allp.second.to_numpy()[has2]] = NE["second_role"]
    batter = (np.isin(allp.main, needs.BATTING) | np.isin(allp.second, needs.BATTING)).astype(float)
    P = {"A": Amat, "Q": Q, "keeper": allp.keeper.to_numpy(int), "lap": allp.lap.to_numpy(int),
         "delta": allp[[f"d_{t}" for t in sk.BOWL_TYPES]].to_numpy(), "batter": batter,
         "bat_z": allp.bat_z.to_numpy(), "spin_bias": allp.spin_bias.to_numpy()[:n]}

    tmpl, keep_tmpl = needs.template(skills_asof(asof), asof)
    _, home = venue_table(asof)
    specs = []
    for code in TEAMS:
        idx = list(n + np.flatnonzero(ret.team.eq(code).to_numpy()))
        edge = sum(g["weight"] * g["spin_edge"] for g in home[code])
        fit = needs.home_fit(P, edge, prof.main.to_numpy())
        mult = 1 + A["home_weight"] * fit if "home_fit" in factors else np.ones(n)
        t = teams.loc[code]
        specs.append({"code": code, "purse": int(t.purse_lakh), "slots": int(t.slots),
                      "os_slots": int(t.overseas_slots), "squad": idx, "style": styles[code],
                      "home_mult": mult, "home": home[code]})
    accel_from = CFG["auction"][str(year)].get("accelerated_from", 10 ** 6)
    return {
        "year": year, "factors": factors, "mode": mode, "n_pool": n,
        "names": allp.name.tolist(), "base": pool.base_lakh.to_numpy(int),
        "overseas": allp.overseas.to_numpy(bool), "value": vals.value_mid.to_numpy(),
        "lot": pool.lot.to_numpy(int), "accel": pool.lot_no.to_numpy() >= accel_from,
        "set": pool.set_no.to_numpy(int),
        "main": allp.main.to_numpy(), "P": P, "teams": specs, "tmpl": tmpl, "keep_tmpl": keep_tmpl,
        "avg_per_slot": market(year),
        "value_sigma": model.sigma,
        "cfg": {"agents": dict(A), "needs": dict(NE), "rules": dict(CFG["rules"])},
        "pool": prof, "retained": rprof, "values": vals, "drivers": model.contributions(vf),
    }
