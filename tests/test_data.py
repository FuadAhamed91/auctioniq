"""Data checks: the inputs match the brief and nothing from the future leaks in."""
import re

import pandas as pd
import pytest

from config import CFG, ROOT

AUC = ROOT / "data" / "auctions"
TEAMS = ["CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RCB", "RR", "SRH"]
BRIEF_2026 = {  # purse (lakhs), slots, overseas slots from the brief
    "CSK": (4340, 9, 4), "DC": (2180, 8, 5), "GT": (1290, 5, 4), "KKR": (6430, 13, 6),
    "LSG": (2295, 6, 4), "MI": (275, 5, 1), "PBKS": (1150, 4, 2), "RCB": (1640, 8, 2),
    "RR": (1605, 9, 1), "SRH": (2550, 10, 2),
}


def test_2026_purses_and_slots_match_the_brief():
    t = pd.read_csv(AUC / "teams_2026.csv").set_index("team")
    for code, (purse, slots, os_slots) in BRIEF_2026.items():
        assert (t.at[code, "purse_lakh"], t.at[code, "slots"], t.at[code, "overseas_slots"]) == (purse, slots, os_slots)
    assert (t.purse_lakh.sum(), t.slots.sum(), t.overseas_slots.sum()) == (23755, 77, 31)


@pytest.mark.parametrize("year", [2024, 2026])
def test_retained_squads_fill_the_other_slots(year):
    t = pd.read_csv(AUC / f"teams_{year}.csv").set_index("team")
    r = pd.read_csv(AUC / f"retained_{year}.csv")
    for code in TEAMS:
        squad = r[r.team == code]
        assert len(squad) == CFG["rules"]["max_squad"] - t.at[code, "slots"] == t.at[code, "squad_size"], code
        assert squad.overseas.sum() == t.at[code, "overseas_count"], code
        assert t.at[code, "overseas_count"] + t.at[code, "overseas_slots"] <= CFG["rules"]["max_overseas"], code


def test_2026_pool_carries_no_results():
    pool = pd.read_csv(AUC / "pool_2026.csv")
    assert not {"status", "team", "price_lakh", "sold", "price"} & set(pool.columns)
    assert pool.lot_no.is_unique and (pool.base_lakh >= 30).all()


@pytest.mark.parametrize("year", [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025])
def test_past_auction_prices_sit_on_the_ladder(year):
    a = pd.read_csv(AUC / f"auction_{year}.csv")
    sold = a[(a.status == "sold") & (a.price_lakh > a.base_lakh)]
    assert sold.team.isin(TEAMS).all()
    bands = CFG["auction"][str(year)].get("rules", {}).get("increments", CFG["rules"]["increments"])
    for price in sold.price_lakh.astype(int):
        step = next(s for up_to, s in bands if price <= up_to)
        assert price % step == 0, (year, price)


OFFICIAL = {  # auction-day pool, sold, total spend (lakhs), overseas sold, per the official records
    2018: (581, 169, 43170, 56), 2019: (352, 60, 10680, 20), 2020: (338, 62, 14030, 29),
    2021: (298, 57, 14530, 22), 2022: (600, 204, 55170, 67),
}


@pytest.mark.parametrize("year", sorted(OFFICIAL))
def test_older_auctions_match_the_official_totals(year):
    """Each file holds the whole auction-day pool, sold and unsold, with the official totals."""
    a = pd.read_csv(AUC / f"auction_{year}.csv")
    sold = a[a.status == "sold"]
    assert (len(a), len(sold), int(sold.price_lakh.sum()), int(sold.overseas.sum())) == OFFICIAL[year]
    assert a.lot_no.tolist() == list(range(1, len(a) + 1))
    assert sold.team.isin(TEAMS).all()


def test_value_models_learn_only_from_earlier_auctions_of_the_same_kind():
    """Mega and mini auctions price players differently, so their data are never mixed."""
    for year, a in CFG["auction"].items():
        for y in a.get("train", []):
            assert y < int(year) and CFG["auction"][str(y)]["kind"] == a["kind"], (year, y)


def test_team_notes_predate_the_auction():
    """The cited background on each franchise was all published before the auction."""
    path = ROOT / "data" / "research" / "team_notes.csv"
    if not path.exists():
        pytest.skip("no team notes yet")
    notes = pd.read_csv(path, dtype=str)
    assert set(notes.team) <= set(TEAMS)
    assert (pd.to_datetime(notes.date) < pd.Timestamp(CFG["data"]["cutoff"])).all()
    assert notes.url.str.startswith("http").all() and notes.note.str.len().le(200).all()


def test_only_the_comparison_script_reads_2026_results():
    readers = []
    for path in list(ROOT.glob("*/*.py")) + list(ROOT.glob("web/src/**/*.js")):
        if path.parent.name == "tests":
            continue
        code = re.sub(r"(#|//).*", "", path.read_text(encoding="utf-8", errors="ignore"))  # comments may mention it
        if re.search(r"actual_2026|results_2026", code):
            readers.append(path.relative_to(ROOT).as_posix())
    assert readers == ["analysis/compare_2026.py"], readers


def test_no_match_on_or_after_the_cutoff():
    from pipeline import deliveries
    d = deliveries.load()
    assert d.date.max() < pd.Timestamp(CFG["data"]["cutoff"])
    assert "The Hundred" not in set(d.comp.astype(str))


def test_config_matches_the_2024_tuning():
    """The weights and factors in config.toml are the ones the 2024 back-test chose."""
    import json
    path = ROOT / "analysis" / "out" / "validation_2024.json"
    if not path.exists():
        pytest.skip("run python -m analysis.tune first")
    v = json.loads(path.read_text(encoding="utf-8"))
    assert sorted(CFG["model"]["factors"]) == v["factors"]
    assert CFG["value"]["ridge"] == v["ridge"]
    for k, w in v["weights"].items():
        assert CFG["agents"][k] == w, k


def test_shipped_runs_replay_exactly():
    """web/public/data was produced by the current code and config: re-simulating a run gives
    the same sales, in the same order, at the same prices."""
    import numpy as np
    from engine import inputs
    from engine.auction import simulate
    path = ROOT / "web" / "public" / "data" / "outcomes.bin"
    if not path.exists():
        pytest.skip("run python -m engine.export first")
    data = np.fromfile(path, dtype="<u2")
    ctx = inputs.build(2026, set(CFG["model"]["factors"]))
    k = 2
    for run in range(2):
        count = int(data[k])
        shipped = [tuple(int(v) for v in data[k + 1 + 4 * j: k + 5 + 4 * j]) for j in range(count)]
        k += 1 + 4 * count
        assert simulate(ctx, run)["records"] == shipped, run
