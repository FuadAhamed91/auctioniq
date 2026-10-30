"""Simulate the 2026 auction and write the app's precomputed data (docs/DATA_CONTRACT.md).

    python -m engine.export
"""
import json
import shutil

import numpy as np
import pandas as pd

from config import CFG, ROOT
from engine import inputs, montecarlo as mc, needs
from pipeline import skills as sk, venues

WEB = ROOT / "web" / "public" / "data"
YEAR = 2026
TYPE_LABELS = ["Right-arm pace", "Left-arm pace", "Off-spin", "Left-arm orthodox", "Leg-spin", "Left-arm wrist spin"]
TAGS = {"wk": "Keeper", "lhb": "Left-handed bat", "lap": "Left-arm pace", "overseas": "Overseas",
        "uncapped": "Uncapped", "fast_start": "Fast starter"}


# value-model features grouped the way a scout talks about a player
DRIVERS = {"history": ["has_prev", "log_prev"], "pedigree": ["capped", "intl_caps", "ipl_exp"],
           "form": ["skill_z", "evidence", "start_z"], "role": ["pace", "spin", "allround", "keeper"],
           "age": ["age", "age2"], "list": ["set_pos"], "base": ["log_base"], "overseas": ["overseas"]}


def _num(v, nd=3):
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), nd)


def _int(v) -> int:
    return 0 if v is None or pd.isna(v) else int(v)


def _tags(r) -> list[str]:
    tags = [t for t, on in (("wk", r.keeper), ("lhb", r.lhb), ("lap", r.lap)) if on]
    if r.get("overseas"):
        tags.append("overseas")
    if str(r.get("capped", "capped")).lower() != "capped":
        tags.append("uncapped")
    if r.start_balls >= CFG["skills"]["z_min_balls"] and r.start_z >= CFG["needs"]["fast_start_z"]:
        tags.append("fast_start")
    return tags


def _role(i) -> str | None:
    return needs.ROLES[int(i)] if i is not None and int(i) >= 0 else None


def highlights(summary: pd.DataFrame, war: np.ndarray, k: int = 6) -> dict:
    """Auction at a glance: most wanted (teams ready to pay base), likely top prices, coin flips."""
    called = (summary.p_called > 0.5).to_numpy()
    contested = np.argsort(-np.where(called, war, -1))[:k]
    priciest = summary["median"].fillna(0).sort_values(ascending=False).index[:k]
    flips = (summary.p_sold - 0.5).abs().where(called).sort_values().index[:k]
    return {"contested": [[int(p), round(float(war[p]), 1)] for p in contested],
            "priciest": [[int(p), int(summary.at[p, "median"])] for p in priciest],
            "coinFlips": [[int(p), round(float(summary.at[p, "p_sold"]), 2)] for p in flips]}


def zero_points(skills: pd.DataFrame) -> dict[str, float]:
    """The average regular in each skill's role group: the zero the app measures from."""
    min_balls = CFG["skills"]["pct_min_balls"]
    out = {}
    for side, roles in sk.ROLE_GROUPS.items():
        member = skills.role.isin(roles) | skills.role2.isin(roles)
        out[side] = float(skills.loc[member & (skills[f"{side}_balls"] >= min_balls), f"{side}_q"].mean())
    out["start"] = float(skills.loc[skills.start_balls >= CFG["skills"]["z_min_balls"], "start_q"].mean())
    return out


def players_json(ctx: dict, summary: pd.DataFrame, feat: list, price: np.ndarray, buyer: np.ndarray,
                 no_needs: pd.DataFrame) -> list:
    pool, vals, drv = ctx["pool"], ctx["values"], ctx["drivers"]
    groups = {g: [c for c in cols if c in drv] for g, cols in DRIVERS.items()}
    zero = zero_points(inputs.skills_asof(inputs.date_of(YEAR)))
    rel = lambda v, side: _num(v - zero[side], 4) if v is not None and not pd.isna(v) else None
    prev = inputs.prev_prices(YEAR)
    out = []
    for i, r in pool.iterrows():
        s = summary.loc[i]
        key = r.cid if isinstance(r.cid, str) and r.cid in prev.index else r["name"]
        pv = prev.loc[key] if key in prev.index else None
        sold = price[buyer[:, i] >= 0, i]
        hist = []
        if len(sold):
            lo, hi = sold.min(), sold.max()
            edges = np.linspace(lo, hi + 1, 21) if hi > lo else np.array([lo, lo + 1])
            counts, _ = np.histogram(sold, edges)
            hist = [[int(e), int(c)] for e, c in zip(edges[:-1], counts)]
        out.append({
            "id": int(i), "lot": int(r.lot), "set": _int(r.get("set_no")),
            "setCode": str(r.get("set_code", "")), "name": r["name"], "country": r.get("country"),
            "overseas": bool(r.overseas), "capped": str(r.get("capped", "")).lower() == "capped",
            "age": _int(r.age) if pd.notna(r.age) else None, "base": int(r.base_lakh),
            "role": _role(r.main), "role2": _role(r.second), "tags": _tags(r),
            "evidence": {"matches": int(r.matches), "batBalls": int(r.bat_balls),
                         "bowlBalls": int(r.bowl_balls), "iplMatches": int(r.ipl_matches)},
            "skills": {
                "bat": {"rv": rel(r.bat_q, "bat"), "pct": _int(r.bat_pct) if pd.notna(r.bat_pct) else None,
                        "balls": int(r.bat_balls), "sr": _num(r.bat_sr, 1),
                        "pp": _num(r.bat_pp, 2), "death": _num(r.bat_death, 2)} if r.bat_balls else None,
                "bowl": {"rv": rel(r.bowl_q, "bowl"), "pct": _int(r.bowl_pct) if pd.notna(r.bowl_pct) else None,
                         "balls": int(r.bowl_balls), "econ": _num(r.bowl_econ, 2),
                         "pp": _num(r.bowl_pp, 2), "death": _num(r.bowl_death, 2)} if r.bowl_balls else None,
                "start": {"rv": rel(r.start_q, "start"), "balls": int(r.start_balls)} if r.start_balls else None,
                "vs": [{"type": t, "rv": rel(r.get(f"vs_{t}"), "bat"), "balls": _int(r.get(f"vsn_{t}"))}
                       for t in sk.BOWL_TYPES],
            },
            "value": {k: int(round(vals.at[i, f"value_{k}"])) for k in ("mid", "lo", "hi")},
            # what lifts or lowers his value against the average player of past auctions (log scale)
            "drivers": sorted(([g, _num(drv.loc[i, cols].sum(), 2)] for g, cols in groups.items() if cols),
                              key=lambda x: -abs(x[1])),
            "prev": {"price": int(pv.price_lakh), "team": pv.team, "year": int(pv.year)} if pv is not None else None,
            "sim": {
                "pSold": _num(s.p_sold), "pCalled": _num(s.p_called),
                "buyers": sorted([[t, _num(s[t])] for t in mc.TEAMS if s[t] > 0], key=lambda x: -x[1]),
                "price": {k: int(round(s[k])) for k in ("p10", "median", "p90", "mean")} if len(sold) else None,
                "hist": hist,
                "feature": [{"run": run, "tag": tag} for run, tag in feat[i]],
                "noNeeds": {"pSold": _num(no_needs.at[i, "p_sold"]),
                            "median": None if pd.isna(no_needs.at[i, "median"])
                            else int(round(no_needs.at[i, "median"]))},
            },
        })
    return out


def _team_needs(ctx: dict, spec: dict) -> list[dict]:
    sq = needs.Squad(spec["squad"], ctx["P"], ctx["tmpl"], ctx["keep_tmpl"], ctx["factors"])
    out = []
    for r, (have, want) in enumerate(zip(sq.counts, ctx["tmpl"])):
        if want - have >= 0.5:
            out.append({"role": needs.ROLES[r], "kind": "depth", "score": round((want - have) / want, 2),
                        "text": f"{needs.LABELS[r]}: {have:g} of {want:.1f} template slots filled"})
    if sq.keepers < ctx["keep_tmpl"] - 0.5:
        out.append({"role": None, "kind": "keeper", "score": round(1 - sq.keepers / ctx["keep_tmpl"], 2),
                    "text": f"Has {sq.keepers} keeper{'s' * int(sq.keepers != 1)}, template {ctx['keep_tmpl']:.1f}"})
    if "matchups" in ctx["factors"]:
        weak = sq.weakness()
        t = int(np.argmin(weak))
        if weak[t] < -CFG["needs"]["weakness_cap"] / 2:
            out.append({"role": None, "kind": "weakness", "score": round(float(-weak[t]), 2),
                        "text": f"Batting core is weak against {TYPE_LABELS[t].lower()}"})
        if sq.lap == 0:
            out.append({"role": "pp_pacer", "kind": "weakness", "score": CFG["needs"]["matchup_weight"],
                        "text": "No left-arm pace option"})
    return sorted(out, key=lambda n: -n["score"])


def _q(v) -> dict:
    return {"p10": _num(np.percentile(v, 10), 2), "median": _num(np.median(v), 2), "p90": _num(np.percentile(v, 90), 2)}


HABITS = ["vet", "youth", "overseas", "capped", "spin", "pace", "allround", "keeper", "former", "star"]
NOTES = ROOT / "data" / "research" / "team_notes.csv"


def team_habits() -> dict:
    """What each franchise bought in the auctions on file, against the league: background for its panel.
    Shares of its buys that were 30 or older (vet), uncapped Indians of 23 or under (youth), overseas,
    capped, spin or pace bowlers, all-rounders, keepers, its own former players, or among the auction's
    top 10% of prices (star); only clear differences are kept. Tested on past auctions, these habits do
    not pick mini-auction buyers better than chance, so the agents do not use them."""
    rows, seen = [], {}
    for y in sorted(int(k) for k in CFG["auction"] if int(k) < YEAR):
        a = inputs.auction_list(y)
        a = a[a.status.eq("sold")]
        key = a.cid.fillna(a.name)
        age = ((pd.Timestamp(inputs.date_of(y)) - pd.to_datetime(a.dob, errors="coerce")).dt.days / 365.25
               ).fillna(pd.to_numeric(a.get("age"), errors="coerce"))
        style = a.bowling_style.astype(str).str.lower()
        spin = style.str.contains("spin|break|orthodox|chinaman|googly")
        bowler, capped, overseas = a.role.isin(["BOWLER", "ALL-ROUNDER"]), a.capped.astype(str).str.lower().eq("capped"), a.overseas.astype(bool)
        rows.append(pd.DataFrame({
            "year": y, "team": a.team, "price": a.price_lakh, "age": age, "vet": age >= 30,
            "youth": (age <= 23) & ~capped & ~overseas, "overseas": overseas, "capped": capped,
            "spin": bowler & spin, "pace": bowler & ~spin & style.str.contains("fast|medium"),
            "allround": a.role.eq("ALL-ROUNDER"), "keeper": a.role.eq("WICKETKEEPER"),
            "former": [t in seen.get(k, ()) for k, t in zip(key, a.team)],
            "star": a.price_lakh >= a.price_lakh.quantile(0.9)}))
        for k, t in zip(key, a.team):
            seen.setdefault(k, set()).add(t)
    df = pd.concat(rows, ignore_index=True)
    league = df[HABITS].mean()
    out = {}
    for t, d in df.groupby("team"):
        share = d[HABITS].mean()
        z = (share - league) / np.sqrt(league * (1 - league) / len(d))
        clear = [k for k in z.abs().sort_values(ascending=False).index
                 if abs(z[k]) >= 1.5 and abs(share[k] - league[k]) >= 0.05][:3]
        out[t] = {"since": int(d.year.min()), "buys": len(d), "medianAge": _num(d.age.median(), 1),
                  "items": [{"key": k, "share": _num(share[k], 2), "league": _num(league[k], 2)} for k in clear],
                  "starSpend": [_num(d.price[d.star].sum() / d.price.sum(), 2),
                                _num(df.price[df.star].sum() / df.price.sum(), 2)]}
    return out


def team_notes() -> dict:
    """Cited background on each franchise's auction habits, all published before the auction (docs/TEAMS.md)."""
    if not NOTES.exists():
        return {}
    notes = pd.read_csv(NOTES, dtype=str).fillna("")
    return {t: d[["note", "outlet", "date", "url"]].to_dict("records") for t, d in notes.groupby("team")}


def meta_json(ctx: dict, team_sum: list, buyer: np.ndarray, validation: dict | None, glance: dict) -> dict:
    retained = ctx["retained"]
    habits, notes = team_habits(), team_notes()
    teams = []
    for i, spec in enumerate(ctx["teams"]):
        ts = team_sum[i]
        probs = (buyer == i).mean(axis=0)
        top = np.argsort(-probs)[:8]
        squad = retained[retained.team.eq(spec["code"])]
        teams.append({
            "code": spec["code"], "purse": spec["purse"], "slots": spec["slots"],
            "overseasSlots": spec["os_slots"], "squadSize": len(spec["squad"]), "style": round(spec["style"], 3),
            "home": [{"venue": g["venue"], "weight": g["weight"], "games": g["games"], "rpo": round(g["rpo"], 2),
                      "boundaryPct": round(g["boundary_pct"], 1), "spinEcon": round(g["spin_econ"], 2),
                      "paceEcon": round(g["pace_econ"], 2), "spinWktShare": round(g["spin_wkt_share"], 2),
                      "spinEdge": round(g["spin_edge"], 2), "boundaryEdge": round(g["boundary_edge"], 1),
                      "note": venues.describe(g)} for g in spec["home"]],
            "retained": [{"name": r["name"], "role": _role(r.main), "role2": _role(r.second),
                          "overseas": bool(r.overseas), "tags": _tags(r)} for _, r in squad.iterrows()],
            "template": {k: round(float(v), 2) for k, v in zip(needs.ROLES, ctx["tmpl"])},
            "needs": _team_needs(ctx, spec),
            "habits": habits.get(spec["code"]), "notes": notes.get(spec["code"], []),
            "sim": {"spend": _q(ts["spend"]), "purseLeft": _q(ts["purseLeft"]), "bought": _q(ts["bought"]),
                    "needsFilled": _q(ts["needsFilled"]),
                    "topTargets": [[int(p), _num(probs[p])] for p in top if probs[p] > 0]},
        })
    r = CFG["rules"]
    return {
        "title": "IPL 2026 mini-auction", "date": CFG["auction"]["2026"]["date"],
        "city": CFG["auction"]["2026"]["city"], "asOf": "2025-12-15",
        "runs": int(buyer.shape[0]), "seed": CFG["montecarlo"]["seed"],
        "rules": {"increments": [[u if u < 10 ** 6 else None, s] for u, s in r["increments"]],
                  "minSquad": r["min_squad"], "maxSquad": r["max_squad"], "maxOverseas": r["max_overseas"],
                  "overseasFeeCap": r["overseas_fee_cap"], "reservePerSlot": r["reserve_per_slot"]},
        "roles": [{"key": k, "label": l} for k, l in zip(needs.ROLES, needs.LABELS)],
        "bowlerTypes": [{"key": k, "label": l} for k, l in zip(sk.BOWL_TYPES, TYPE_LABELS)],
        "tags": TAGS, "teams": teams, "factors": sorted(ctx["factors"]),
        "validation": validation, "highlights": glance,
    }


def outcomes_bin(results: list[tuple], n: int) -> bytes:
    data = [len(results), n]
    for _, records, *_ in results:
        data.append(len(records))
        for p, team, price, rnd in records:
            data += [p, team, price, rnd]
    return np.asarray(data, dtype="<u2").tobytes()


def main() -> None:
    factors = set(CFG["model"]["factors"])
    ctx = inputs.build(YEAR, factors)
    runs = CFG["montecarlo"]["runs"]
    print(f"Simulating {runs} runs of {YEAR} with factors {sorted(factors)}")
    results = mc.run_many(ctx, range(runs), write_logs=True)
    n = ctx["n_pool"]
    buyer, price = mc.outcome_arrays(results, n)
    summary = mc.player_summary(buyer, price)
    feat = mc.featured(buyer, price, summary, CFG["montecarlo"]["featured"])
    wanted: dict[int, set] = {}
    for p, picks in enumerate(feat):
        for run, _ in picks:
            wanted.setdefault(run, set()).add(p)
    print("Simulating the value-only counterfactual")
    nb, npr = mc.outcome_arrays(mc.run_many(inputs.build(YEAR, set()), range(runs)), n)
    no_needs = mc.player_summary(nb, npr)
    print(f"Replaying {len(wanted)} featured runs in detail")
    detailed = mc.run_many(ctx, sorted(wanted), detail=wanted)
    lots: dict[int, dict] = {p: {str(run): [] for run, _ in picks} for p, picks in enumerate(feat)}
    for run, _, _, details, _ in detailed:
        for p, apps in details.items():
            lots[p][str(run)] = apps

    validation = None
    vpath = ROOT / "analysis" / "out" / "validation_2024.json"
    if vpath.exists():
        validation = json.loads(vpath.read_text(encoding="utf-8"))
    shutil.rmtree(WEB, ignore_errors=True)
    (WEB / "lots").mkdir(parents=True)
    dump = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    glance = highlights(summary, mc.ready_to_bid(results, n))
    (WEB / "players.json").write_text(dump(players_json(ctx, summary, feat, price, buyer, no_needs)),
                                      encoding="utf-8")
    (WEB / "meta.json").write_text(dump(meta_json(ctx, mc.team_summary(ctx, results), buyer, validation, glance)),
                                   encoding="utf-8")
    (WEB / "outcomes.bin").write_bytes(outcomes_bin(results, n))
    for p, runs_ in lots.items():
        (WEB / "lots" / f"{p}.json").write_text(dump({"id": p, "runs": runs_}), encoding="utf-8")
    summary.assign(name=ctx["pool"]["name"].to_numpy()).to_csv(
        ROOT / "engine" / "out" / f"summary_{YEAR}.csv", index_label="id", float_format="%.4f")
    print(f"Wrote {WEB}")


if __name__ == "__main__":
    main()
