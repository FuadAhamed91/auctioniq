"""Engine invariants on a small synthetic auction."""
import numpy as np
import pytest

from config import CFG
from engine import needs, rules
from engine.auction import UNSOLD, simulate

TEAMS = ["CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RCB", "RR", "SRH"]


def tiny_ctx(factors=frozenset({"needs", "matchups", "home_fit"}), mode="value", n_pool=60, squad=16):
    rng = np.random.default_rng(7)
    n_all = n_pool + squad * len(TEAMS)
    main = rng.integers(0, 9, n_all)
    A = np.zeros((n_all, 9))
    A[np.arange(n_all), main] = 1
    Q = rng.normal(size=(n_all, 9))
    base = rng.choice([30, 50, 75, 100, 150, 200], n_pool)
    P = {"A": A, "Q": Q, "keeper": (rng.random(n_all) < 0.1).astype(int),
         "lap": (rng.random(n_all) < 0.1).astype(int), "delta": rng.normal(0, 0.5, (n_all, 6)),
         "batter": np.isin(main, needs.BATTING).astype(float), "bat_z": Q[:, 0],
         "spin_bias": rng.normal(0, 0.5, n_pool)}
    teams = []
    for i, code in enumerate(TEAMS):
        members = list(range(n_pool + i * squad, n_pool + (i + 1) * squad))
        teams.append({"code": code, "purse": int(rng.integers(200, 3000)), "slots": 25 - squad,
                      "os_slots": int(rng.integers(0, 4)), "squad": members, "style": 1.0,
                      "home_mult": np.ones(n_pool)})
    return {
        "year": 2026, "factors": set(factors), "mode": mode, "n_pool": n_pool,
        "names": [f"P{i}" for i in range(n_all)], "base": base,
        "overseas": rng.random(n_all) < 0.3, "value": base * np.exp(rng.normal(0.8, 0.8, n_pool)),
        "lot": np.arange(1, n_pool + 1), "accel": np.arange(1, n_pool + 1) > 30, "main": main, "P": P,
        "set": np.arange(n_pool) // 7 + 1,
        "teams": teams, "tmpl": np.full(9, 25 / 9), "keep_tmpl": 2.0,
        "avg_per_slot": sum(t["purse"] for t in teams) / sum(t["slots"] for t in teams),
        "value_sigma": 0.8,
        "cfg": {"agents": dict(CFG["agents"]), "needs": dict(CFG["needs"])},
    }


@pytest.mark.parametrize("mode", ["value", "need_only"])
def test_invariants(mode):
    ctx = tiny_ctx(mode=mode)
    for run in range(5):
        res = simulate(ctx, run)
        spent = {i: 0 for i in range(len(TEAMS))}
        overseas = {i: 0 for i in range(len(TEAMS))}
        seen = set()
        for p, team, price, rnd in res["records"]:
            assert rnd in (0, 1, 2)
            if team == UNSOLD:
                continue
            assert p not in seen, "a player can be sold only once"
            seen.add(p)
            assert price >= ctx["base"][p]
            ladder = ctx["base"][p]
            while ladder < price:
                ladder = rules.next_bid(ladder)
            assert ladder == price, "every price sits on the bid ladder"
            spent[team] += price
            overseas[team] += int(ctx["overseas"][p])
        for i, (spec, t) in enumerate(zip(ctx["teams"], res["teams"])):
            assert t["purse"] == spec["purse"] - spent[i] >= 0
            assert len(t["bought"]) <= spec["slots"]
            assert overseas[i] <= spec["os_slots"]
            short = max(0, rules.RULES["min_squad"] - t["size"])
            assert t["purse"] >= rules.RULES["reserve_per_slot"] * short, "reserve rule held"


def test_runs_are_reproducible():
    ctx = tiny_ctx()
    assert simulate(ctx, 3)["records"] == simulate(ctx, 3)["records"]
    assert simulate(ctx, 3)["records"] != simulate(ctx, 4)["records"]


def test_replayed_runs_are_a_random_draw_of_called_runs():
    from engine.montecarlo import featured
    rng = np.random.default_rng(1)
    buyer = rng.integers(-2, 10, (200, 5))
    buyer[:, 4] = -2  # never called
    picks = featured(buyer, 6, seed=11)
    assert picks == featured(buyer, 6, seed=11), "seeded"
    assert picks[4] == []
    for p, runs in enumerate(picks[:4]):
        assert len(runs) == len(set(runs)) == 6
        assert all(buyer[r, p] != -2 for r in runs), "only runs he was called in"
    assert picks[0] != featured(buyer, 6, seed=12)[0]


def test_detail_lots_explain_every_team():
    ctx = tiny_ctx()
    res = simulate(ctx, 0, detail=set(range(10)))
    lot = next(iter(res["details"].values()))[0]
    assert set(lot["teams"]) == set(TEAMS)
    for d in lot["teams"].values():
        assert [g[0] for g in d["gate"]] == ["need", "slot", "overseas", "purse"]
        if d["open"]:
            raw = np.prod(list(d["f"].values()))
            assert np.isclose(raw, d["walk"], rtol=0.02) or d["walk"] in (d["cap"], d["floor"])
    kinds = {e[0] for e in lot["events"]}
    assert kinds & {"sold", "unsold"}


def test_two_teams_bid_at_a_time():
    """Two paddles at a time: the team just outbid answers back, or it is out for good and a team
    that has not bid yet comes in."""
    for row in simulate(tiny_ctx(), 1)["log"]:
        b = [e[1] for e in row["events"] if e[0] == "bid"]
        for i in range(2, len(b)):
            assert b[i] == b[i - 2] or b[i] not in b[:i], (row["player"], b)


def test_settlement_rule():
    from engine.auction import settle
    # one bidder pays base
    assert settle({3: 900.0}, 200) == (3, 200, None)
    # runner-up can go to 5.00 Cr (next point 5.25), winner can pay 5.25
    assert settle({1: 600.0, 2: 511.0}, 200) == (1, 525, 2)
    # both limits inside one step: the higher limit wins at the runner-up's last point
    assert settle({1: 515.0, 2: 511.0}, 200) == (1, 500, 2)


def test_replayed_bids_are_legal():
    from engine.rules import next_bid
    ctx = tiny_ctx()
    res = simulate(ctx, 1)
    for row in res["log"]:
        ev = row["events"]
        bids = [e for e in ev if e[0] == "bid"]
        if not bids:
            continue
        assert ev[-1][0] == "sold" and bids[-1][1] == ev[-1][1] and bids[-1][2] == ev[-1][2]
        for (_, a, pa), (_, b, pb) in zip(bids, bids[1:]):
            assert a != b and pb == next_bid(pa)
        out = {e[1] for e in ev if e[0] == "drop"}
        assert ev[-1][1] not in out
