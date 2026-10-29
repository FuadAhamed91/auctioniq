"""Compare the simulated 2026 auction with what really happened. Kept apart from the app:
this is the only code that reads data/actual_2026/.

    python -m analysis.compare_2026      # after python -m engine.export
"""
import numpy as np
import pandas as pd

from analysis import metrics
from analysis.tune import baselines, need_hits, predictions
from config import CFG, ROOT
from engine import inputs

YEAR = 2026
OUT = ROOT / "analysis" / "out"


def load() -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    ctx = inputs.build(YEAR, set(CFG["model"]["factors"]))
    sim = pd.read_csv(ROOT / "engine" / "out" / f"summary_{YEAR}.csv", index_col="id")
    base = pd.Series(ctx["base"], dtype=float)
    for k in ("median", "p10", "p90"):
        sim[k] = sim[k].fillna(base)
    real = pd.read_csv(ROOT / "data" / "actual_2026" / "results_2026.csv")
    names = ctx["pool"]["name"]
    real = real.set_index("name").reindex(names).reset_index()
    missing = real.status.isna().sum()
    if missing:
        print(f"{missing} pool players have no 2026 result row; counted as unsold")
    act = pd.DataFrame({"sold": real.status.eq("sold"), "team": real.team, "price": real.price_lakh})
    act["need_hit"] = need_hits(ctx, act.team.fillna(""))
    return sim, act, ctx


def comparisons(ctx: dict) -> dict[str, pd.DataFrame]:
    out = baselines(ctx, YEAR)
    print("Simulating the value-without-needs baseline")
    out["Value without needs"] = predictions(inputs.build(YEAR, set()), CFG["montecarlo"]["runs"])
    return out


def table(results: dict[str, dict]) -> str:
    keys = [k for k in metrics.NAMES if any(k in r for r in results.values())]
    lines = ["| Model | " + " | ".join(metrics.NAMES[k] for k in keys) + " |",
             "|---|" + "---|" * len(keys)]
    for name, r in results.items():
        cells = [f"{r[k]['est']:.3f} [{r[k]['lo']:.3f}, {r[k]['hi']:.3f}]" if k in r else "–" for k in keys]
        lines.append(f"| {name} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def misses(sim: pd.DataFrame, act: pd.DataFrame, names: pd.Series, n: int = 12) -> str:
    sold = act.sold.to_numpy()
    err = np.log(act.price.where(sold)) - np.log(sim["median"])
    df = pd.DataFrame({"Player": names, "Real": act.price, "Buyer": act.team, "Sim median": sim["median"],
                       "80% range": [f"{a:.0f}–{b:.0f}" for a, b in zip(sim.p10, sim.p90)],
                       "P(sold)": sim.p_sold, "err": err})
    top = df[sold].reindex(df[sold].err.abs().sort_values(ascending=False).index).head(n)
    lines = ["| Player | Real (₹ L) | Buyer | Sim median | 80% range | P(sold) | log error |", "|---|---|---|---|---|---|---|"]
    lines += [f"| {r.Player} | {r.Real:.0f} | {r.Buyer} | {r['Sim median']:.0f} | {r['80% range']} | "
              f"{r['P(sold)']:.2f} | {r.err:+.2f} |" for _, r in top.iterrows()]
    surprise_sold = df[sold & (df["P(sold)"] < 0.2)].Player.tolist()
    surprise_unsold = df[~sold & (df["P(sold)"] > 0.8)].Player.tolist()
    lines += ["", f"Sold although P(sold) < 0.2: {', '.join(surprise_sold) or 'none'}",
              f"Unsold although P(sold) > 0.8: {', '.join(surprise_unsold) or 'none'}"]
    return "\n".join(lines)


def main() -> None:
    sim, act, ctx = load()
    results = {"AuctionIQ": metrics.evaluate(sim, act)}
    for name, pred in comparisons(ctx).items():
        results[name] = metrics.evaluate(pred.reset_index(drop=True), act.drop(columns="need_hit"))
    report = "\n\n".join([
        "# AuctionIQ vs the real IPL 2026 auction",
        f"{len(act)} players in the list, {int(act.sold.sum())} sold in reality. "
        f"Simulation: {CFG['montecarlo']['runs']} runs with only pre-auction data. "
        "Each metric shows the estimate and a bootstrap 95% interval (players resampled, 2,000 draws).",
        "## Metrics", table(results),
        "MAE and Spearman use players sold in reality (simulated median price given sold; base price if never "
        "sold in a run). Coverage = real price inside the simulated 10th–90th percentile. Top 3 = the real "
        "buyer is among the three teams that bought him most often. Need hit = the real buyer had a "
        "pre-auction need for him. The 2024 numbers in the app are tuning-set fits; this is the held-out test.",
        "## Biggest misses", misses(sim, act, ctx["pool"]["name"]),
    ])
    OUT.mkdir(exist_ok=True)
    (OUT / "comparison_2026.md").write_text(report + "\n", encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
