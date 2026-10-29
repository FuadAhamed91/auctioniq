"""Prediction metrics shared by tuning (2024) and the 2026 comparison, with bootstrap intervals.

pred (one row per player): p_sold, median, p10, p90 (prices given sold, lakhs) and one
probability column per team code. actual: sold (bool), team, price.
"""
import numpy as np
import pandas as pd

TEAMS = ["CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RCB", "RR", "SRH"]
NAMES = {"mae": "MAE on log price", "spearman": "Spearman (price)", "auc": "Sold/unsold AUC",
         "top3": "Real buyer in top 3", "cover80": "80% range coverage", "need_hit": "Need hit rate"}


def ranks(x: np.ndarray) -> np.ndarray:
    return pd.Series(x).rank().to_numpy()


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    if len(a) < 3:
        return np.nan
    return float(np.corrcoef(ranks(a), ranks(b))[0, 1])


def auc(score: np.ndarray, label: np.ndarray) -> float:
    """Probability a random sold player scores higher than a random unsold one (ties count half)."""
    pos, neg = label.sum(), (~label).sum()
    if pos == 0 or neg == 0:
        return np.nan
    r = ranks(score)
    return float((r[label].sum() - pos * (pos + 1) / 2) / (pos * neg))


def top3_hit(probs: np.ndarray, team: str) -> float:
    """Credit for the real buyer being among the three likeliest buyers. No credit if the model
    gave him no chance; ties for the last places share the credit."""
    p = probs[TEAMS.index(team)]
    if p <= 0:
        return 0.0
    above, level = int(np.sum(probs > p)), int(np.sum(probs == p))
    return float(np.clip((3 - above) / level, 0, 1))


def point(pred: pd.DataFrame, act: pd.DataFrame) -> dict:
    sold = act.sold.to_numpy(bool)
    both = sold & pred["median"].notna().to_numpy()
    out = {"auc": auc(pred.p_sold.to_numpy(), sold), "n": int(len(act)), "n_sold": int(sold.sum())}
    if both.any():
        p, a = pred[both], act[both]
        out["mae"] = float(np.mean(np.abs(np.log(a.price.to_numpy()) - np.log(p["median"].to_numpy()))))
        out["spearman"] = spearman(a.price.to_numpy(), p["median"].to_numpy())
        out["cover80"] = float(np.mean((a.price >= p.p10) & (a.price <= p.p90)))
    if all(t in pred for t in TEAMS) and sold.any():
        out["top3"] = float(np.mean([top3_hit(row, team) for row, team in
                                     zip(pred.loc[sold, TEAMS].to_numpy(), act.loc[sold, "team"])]))
    if "need_hit" in act and sold.any():
        out["need_hit"] = float(act.loc[sold, "need_hit"].mean())
    return out


def paired(pred_a: pd.DataFrame, pred_b: pd.DataFrame, act: pd.DataFrame, reps: int = 2000, seed: int = 0) -> dict:
    """Difference b − a for each metric, with a 95% interval from resampling the same players for
    both models (tighter, and fairer, than comparing two separate intervals)."""
    pred_a, pred_b, act = (x.reset_index(drop=True) for x in (pred_a, pred_b, act))
    a0, b0 = point(pred_a, act), point(pred_b, act)
    rng = np.random.default_rng(seed)
    draws = {k: [] for k in NAMES if k in a0 and k in b0}
    for _ in range(reps):
        i = rng.integers(0, len(act), len(act))
        sub = act.iloc[i].reset_index(drop=True)
        a, b = point(pred_a.iloc[i].reset_index(drop=True), sub), point(pred_b.iloc[i].reset_index(drop=True), sub)
        for k in draws:
            draws[k].append(b.get(k, np.nan) - a.get(k, np.nan))
    return {k: {"diff": b0[k] - a0[k], "lo": float(np.nanpercentile(v, 2.5)), "hi": float(np.nanpercentile(v, 97.5))}
            for k, v in draws.items()}


def evaluate(pred: pd.DataFrame, act: pd.DataFrame, reps: int = 2000, seed: int = 0) -> dict:
    """Point estimates and bootstrap 95% intervals (players resampled with replacement)."""
    pred, act = pred.reset_index(drop=True), act.reset_index(drop=True)
    est = point(pred, act)
    rng = np.random.default_rng(seed)
    draws = []
    for _ in range(reps):
        i = rng.integers(0, len(act), len(act))
        draws.append(point(pred.iloc[i].reset_index(drop=True), act.iloc[i].reset_index(drop=True)))
    out = {}
    for k in NAMES:
        if k in est:
            vals = np.array([d.get(k, np.nan) for d in draws], float)
            lo, hi = np.nanpercentile(vals, [2.5, 97.5])
            out[k] = {"est": est[k], "lo": float(lo), "hi": float(hi)}
    out["n"], out["n_sold"] = est["n"], est["n_sold"]
    return out
