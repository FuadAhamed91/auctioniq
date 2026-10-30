"""Seeded Monte Carlo runs of an auction, in parallel, aggregated per player and per team.

Run r always uses the seed (config seed, year, r), so any run can be replayed exactly.
"""
import atexit
import gzip
import json
import os
from multiprocessing import Pool

import numpy as np
import pandas as pd

from config import CFG, ROOT
from engine import needs
from engine.auction import UNSOLD, simulate

LOGS = ROOT / "engine" / "out" / "logs"
TEAMS = ["CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RCB", "RR", "SRH"]
HEAVY = ("pool", "retained", "values")
_POOL = None


def _pool() -> Pool:
    """One worker pool for the whole process (starting workers costs seconds on Windows)."""
    global _POOL
    if _POOL is None:
        _POOL = Pool(min(os.cpu_count() or 1, 8))
        atexit.register(_POOL.terminate)
    return _POOL


def _batch(args: tuple) -> list[tuple]:
    ctx, runs, write, detail = args
    for section, values in ctx["cfg"].items():  # weights as set in the parent process
        CFG[section].update(values)
    out = []
    for run in runs:
        res = simulate(ctx, run, (detail or {}).get(run))
        if write:
            with gzip.open(LOGS / str(ctx["year"]) / f"run_{run:04d}.jsonl.gz", "wt", encoding="utf-8") as f:
                for row in res["log"]:
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
        teams = [(t["purse"], t["bought"]) for t in res["teams"]]
        out.append((run, res["records"], teams, res["details"], res["willing"]))
    return out


def run_many(ctx: dict, runs, write_logs: bool = False, detail: dict | None = None) -> list[tuple]:
    """Simulate the given runs in parallel. detail: run -> set of players to record in full."""
    if write_logs:
        (LOGS / str(ctx["year"])).mkdir(parents=True, exist_ok=True)
    slim = {k: v for k, v in ctx.items() if k not in HEAVY}
    runs = list(runs)
    size = max(1, len(runs) // 32)
    batches = [(slim, runs[i:i + size], write_logs,
                {r: detail[r] for r in runs[i:i + size] if r in detail} if detail else None)
               for i in range(0, len(runs), size)]
    out = [row for batch in _pool().map(_batch, batches) for row in batch]
    return sorted(out, key=lambda x: x[0])


def outcome_arrays(results: list[tuple], n: int) -> tuple[np.ndarray, np.ndarray]:
    """buyer[run, player] (team index, -1 unsold, -2 never called) and price[run, player]."""
    buyer = np.full((len(results), n), -2, int)
    price = np.zeros((len(results), n), int)
    for k, (_, records, *_) in enumerate(results):
        for p, team, pr, _ in records:
            buyer[k, p] = -1 if team == UNSOLD else team
            price[k, p] = pr
    return buyer, price


def ready_to_bid(results: list[tuple], n: int) -> np.ndarray:
    """Average number of teams ready to pay at least his base price when he first came up."""
    total, seen = np.zeros(n), np.zeros(n)
    for _, records, _, _, willing in results:
        first = set()
        for (p, *_), k in zip(records, willing):
            if p not in first:
                first.add(p)
                total[p] += k
                seen[p] += 1
    return np.divide(total, seen, out=np.zeros(n), where=seen > 0)


def player_summary(buyer: np.ndarray, price: np.ndarray) -> pd.DataFrame:
    runs = buyer.shape[0]
    sold = buyer >= 0
    rows = []
    for p in range(buyer.shape[1]):
        s = price[sold[:, p], p]
        row = {"p_sold": sold[:, p].mean(), "p_called": (buyer[:, p] != -2).mean()}
        row.update({t: np.mean(buyer[:, p] == i) for i, t in enumerate(TEAMS)})
        if len(s):
            row.update(p10=np.percentile(s, 10), median=np.median(s), p90=np.percentile(s, 90), mean=s.mean())
        rows.append(row)
    out = pd.DataFrame(rows)
    out.attrs["runs"] = runs
    return out


def featured(buyer: np.ndarray, k: int, seed: int) -> list[list[int]]:
    """Per player: k runs drawn at random from the runs he was called in, replayed bid by bid in the app.

    A random draw, not the run nearest his median, so a replayed lot can land above or below the median
    like a live one. Seeded per player, so the export is reproducible.
    """
    out = []
    for p in range(buyer.shape[1]):
        called = np.flatnonzero(buyer[:, p] != -2)
        rng = np.random.default_rng([seed, p])
        out.append([int(r) for r in rng.choice(called, size=min(k, len(called)), replace=False)])
    return out


def team_summary(ctx: dict, results: list[tuple]) -> list[dict]:
    """Spend, purse left, players bought and share of the pre-auction depth gap filled."""
    P, tmpl = ctx["P"], ctx["tmpl"]
    out = []
    for i, spec in enumerate(ctx["teams"]):
        base = needs.Squad(spec["squad"], P, tmpl, ctx["keep_tmpl"], ctx["factors"])
        gap0 = np.clip(tmpl - base.counts, 0, None).sum()
        spend, left, bought, filled = [], [], [], []
        for _, _, teams, *_ in results:
            purse, got = teams[i]
            counts = base.counts + P["A"][got].sum(axis=0) if got else base.counts
            gap1 = np.clip(tmpl - counts, 0, None).sum()
            spend.append(spec["purse"] - purse)
            left.append(purse)
            bought.append(len(got))
            filled.append((gap0 - gap1) / gap0 if gap0 > 0 else 1.0)
        out.append({"spend": spend, "purseLeft": left, "bought": bought, "needsFilled": filled,
                    "gap0": float(gap0)})
    return out
