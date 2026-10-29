"""Tune the agent weights and run the ablation on the 2024 mini-auction, using only what was
known before it: skills as of 19 Dec 2023, and a value model and team styles fitted on the 2023
auction alone. The real 2024 results are the target, so these are tuning-set numbers; the honest
out-of-sample test is the 2026 comparison.

    python -m analysis.tune            # writes analysis/out/validation_2024.json
"""
import json

import numpy as np
import pandas as pd

from analysis import metrics
from config import CFG, ROOT
from engine import inputs, montecarlo as mc, needs

YEAR = 2024
OUT = ROOT / "analysis" / "out"
ALL = {"needs", "matchups", "start_speed", "home_fit"}
FACTORS = ["needs", "matchups", "start_speed", "home_fit"]
LABELS = {"needs": "needs", "matchups": "matchups", "start_speed": "start speed", "home_fit": "home fit"}
SEARCH = {  # coordinate search; each range brackets the weight's plausible values
    "market_share": [0.6, 0.8, 1.0],
    "noise_sigma": [0.05, 0.15, 0.3],
    "pressure_beta": [0.2, 0.5, 0.8, 1.1],
    "scarcity_alpha": [0.0, 0.1, 0.25],
    "need_slope": [0.4, 0.8, 1.2],
}


def predictions(ctx: dict, runs: int, start: int = 0) -> pd.DataFrame:
    """Per player: P(sold), price quantiles given sold (base price if never sold), P(buyer)."""
    buyer, price = mc.outcome_arrays(mc.run_many(ctx, range(start, start + runs)), ctx["n_pool"])
    s = mc.player_summary(buyer, price)
    base = pd.Series(ctx["base"], dtype=float)
    for k in ("median", "p10", "p90"):
        s[k] = s[k].fillna(base) if k in s else base
    return s


def need_hits(ctx: dict, teams: pd.Series) -> np.ndarray:
    """Whether each real buyer had a pre-auction need for his player (needs model, all factors)."""
    hits = np.zeros(len(teams), bool)
    for spec in ctx["teams"]:
        sq = needs.Squad(spec["squad"], ctx["P"], ctx["tmpl"], ctx["keep_tmpl"], ALL)
        mine = teams.eq(spec["code"]).to_numpy()
        hits[mine] = sq.needs(np.arange(ctx["n_pool"]))[0][mine] >= CFG["needs"]["gate"]
    return hits


def actuals(ctx: dict) -> pd.DataFrame:
    """Real 2024 outcomes, in the context's player order."""
    pool = ctx["pool"]
    return pd.DataFrame({"sold": pool.status.eq("sold").to_numpy(), "team": pool.team.to_numpy(),
                         "price": pool.price_lakh.to_numpy()})


def baselines(ctx: dict, year: int) -> dict[str, pd.DataFrame]:
    """Naive predictors: every player at his base price, or at his last IPL price."""
    base = pd.Series(ctx["base"], dtype=float)
    prev = inputs.value_frame(ctx["pool"], year, ctx["factors"]).prev_price.reset_index(drop=True)
    last = prev.fillna(base)
    return {"Base price": pd.DataFrame({"p_sold": base, "median": base, "p10": base, "p90": base}),
            "Last IPL price": pd.DataFrame({"p_sold": prev.fillna(0), "median": last, "p10": last, "p90": last})}


def tune_ridge() -> tuple[float, list]:
    """Pick the value model's ridge penalty by its own 2024 price error (no simulation)."""
    pool = inputs.auction_list(YEAR)
    sold = pool.status.eq("sold").to_numpy()
    prof = inputs.profile(pool, inputs.date_of(YEAR), ALL)
    frame = inputs.value_frame(prof, YEAR, ALL).assign(mega=0.0)
    rows = []
    for lam in (0.5, 1, 2, 4, 8, 16, 32, 64):
        model, _ = inputs.fit_value(YEAR, ALL, lam)
        mid = model.predict(frame, np.log(inputs.market(YEAR))).value_mid.to_numpy()
        mae = float(np.mean(np.abs(np.log(pool.price_lakh.to_numpy()[sold]) - np.log(mid[sold]))))
        rows.append({"ridge": lam, "mae": round(mae, 4)})
        print(f"ridge {lam:>5}: value-model MAE {mae:.3f}", flush=True)
    return min(rows, key=lambda r: r["mae"])["ridge"], rows


def objective(m: dict) -> float:
    """Price error first, then calibration of the 80% range."""
    return m["mae"] + 0.5 * abs(m["cover80"] - 0.8)


def search(runs: int, passes: int = 1) -> tuple[dict, list]:
    """Coordinate search over the agent weights, on one context and common random numbers."""
    ctx = inputs.build(YEAR, ALL)
    act = actuals(ctx)
    best = {k: CFG["agents"][k] for k in SEARCH}
    seen, log = {}, []

    def score(w: dict) -> float:
        key = tuple(sorted(w.items()))
        if key not in seen:
            ctx["cfg"]["agents"] = {**CFG["agents"], **w}
            m = metrics.point(predictions(ctx, runs), act)
            seen[key] = objective(m)
            log.append({**w, **{k: round(m[k], 4) for k in ("mae", "spearman", "auc", "top3", "cover80")},
                        "objective": round(seen[key], 4)})
            print(log[-1], flush=True)
        return seen[key]

    for _ in range(passes):
        for k, values in SEARCH.items():
            best[k] = min(values, key=lambda v: score({**best, k: v}))
    return best, log


def significant(delta: dict) -> bool:
    """Strict test, reported for transparency: the paired 95% interval of price error or buyer
    accuracy excludes zero, and the other does not clearly get worse."""
    mae, top3 = delta["mae"], delta["top3"]
    return (mae["hi"] < 0 or top3["lo"] > 0) and not (mae["lo"] > 0 or top3["hi"] < 0)


def beyond_noise(delta: dict, noise: dict) -> bool:
    """The decision rule: a factor stays if it improves price error or buyer accuracy by more than
    the simulation's own seed-to-seed noise, and does not make the other worse by more than it."""
    d_mae, d_top3 = delta["mae"]["diff"], delta["top3"]["diff"]
    return ((d_mae < -noise["mae"] and d_top3 > -noise["top3"])
            or (d_top3 > noise["top3"] and d_mae < noise["mae"]))


def seed_noise(ctx: dict, runs: int, act: pd.DataFrame, blocks: int = 3) -> dict:
    """How much the metrics move between independent blocks of runs of the same model (2 sd)."""
    scores = [metrics.point(predictions(ctx, runs, b * runs), act) for b in range(blocks)]
    return {k: round(2 * float(np.std([s[k] for s in scores], ddof=1)), 4) for k in ("mae", "top3")}


def ablation(runs: int) -> tuple[list[dict], set, tuple, dict]:
    """Forward selection: each factor joins the kept set only if it clearly improves the back-test."""
    def run(label, factors, mode="value"):
        ctx = inputs.build(YEAR, factors, mode)
        pred, act = predictions(ctx, runs), actuals(ctx)
        row = {"model": label, "factors": sorted(factors), "mode": mode, **metrics.evaluate(pred, act)}
        print(label, {k: round(v["est"], 3) for k, v in row.items() if isinstance(v, dict)}, flush=True)
        return row, (pred, act, ctx)

    best, chosen = run("Value only", set())
    noise = seed_noise(chosen[2], runs, chosen[1])
    print("seed noise (2 sd)", noise, flush=True)
    rows, kept = [best], set()
    for f in FACTORS:
        row, cand = run("+ " + LABELS[f], kept | {f})
        row["delta"] = metrics.paired(chosen[0], cand[0], cand[1])  # against the model it would replace
        row["kept"] = beyond_noise(row["delta"], noise)
        row["significant95"] = significant(row["delta"])
        rows.append(row)
        if row["kept"]:
            kept, chosen = kept | {f}, cand
    rows.append(run("Need only (no value)", kept | {"needs"}, "need_only")[0])
    for name, pred in baselines(chosen[2], YEAR).items():
        rows.append({"model": name, "factors": [], "mode": "baseline", **metrics.evaluate(pred, chosen[1])})
    return rows, kept, chosen, noise


def points(pred: pd.DataFrame, act: pd.DataFrame, names: pd.Series) -> list[dict]:
    """Per-player back-test rows for the calibration chart."""
    return [{"name": n, "sold": bool(a.sold), "price": int(a.price) if a.sold else None,
             "median": int(round(p["median"])), "p10": int(round(p.p10)), "p90": int(round(p.p90)),
             "pSold": round(float(p.p_sold), 3)}
            for n, (_, p), (_, a) in zip(names, pred.iterrows(), act.iterrows())]


def main(search_runs: int = 200, runs: int = 800, ablation_only: bool = False) -> None:
    """Full tuning; with ablation_only, reuse the ridge and weights already in config.toml."""
    OUT.mkdir(exist_ok=True)
    if ablation_only:
        old = json.loads((OUT / "validation_2024.json").read_text(encoding="utf-8"))
        ridge, ridge_rows, log = CFG["value"]["ridge"], old["ridgeScan"], old["search"]
        best = {k: CFG["agents"][k] for k in SEARCH}
    else:
        ridge, ridge_rows = tune_ridge()
        CFG["value"]["ridge"] = ridge
        best, log = search(search_runs)
        CFG["agents"].update(best)
    rows, kept, (pred, act, ctx), noise = ablation(runs)
    sold = act.sold.to_numpy()
    hits = need_hits(ctx, act.team.where(act.sold, ""))[sold]
    table = [{"model": r["model"], "mode": r["mode"], "n": r["n"], "kept": r.get("kept"),
              "significant95": r.get("significant95"),
              **{k: round(r[k]["est"], 3) for k in metrics.NAMES if k in r},
              "ci": {k: [round(r[k]["lo"], 3), round(r[k]["hi"], 3)] for k in metrics.NAMES if k in r},
              "delta": {k: [round(d["diff"], 3), round(d["lo"], 3), round(d["hi"], 3)]
                        for k, d in r.get("delta", {}).items()}}
             for r in rows]
    result = {
        "auction": "2024 mini-auction", "note": "tuning set: the weights and factors were chosen on it",
        "runs": runs, "ridge": ridge, "ridgeScan": ridge_rows, "weights": best, "search": log,
        "rows": table, "factors": sorted(kept), "seedNoise": noise,
        "rule": "kept if it improves price error or buyer accuracy by more than the seed-to-seed noise "
                "of the simulation without worsening the other by more; significant95 = the strict paired test",
        "kept": [LABELS[f] for f in FACTORS if f in kept],
        "dropped": [LABELS[f] for f in FACTORS if f not in kept],
        "needHit": {"est": round(float(hits.mean()), 3), "n": int(sold.sum())},
        "points": points(pred, act, ctx["pool"]["name"]),
    }
    (OUT / "validation_2024.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    print(json.dumps({"ridge": ridge, "weights": best, "factors": sorted(kept)}, indent=1))


if __name__ == "__main__":
    import sys
    main(ablation_only="--ablation" in sys.argv)
