import numpy as np
import pandas as pd

from analysis.metrics import auc, point, spearman


def test_auc_perfect_and_reversed():
    label = np.array([True, True, False, False])
    assert auc(np.array([0.9, 0.8, 0.2, 0.1]), label) == 1.0
    assert auc(np.array([0.1, 0.2, 0.8, 0.9]), label) == 0.0
    assert auc(np.array([0.5, 0.5, 0.5, 0.5]), label) == 0.5


def test_spearman_monotone():
    a = np.array([1, 2, 3, 4, 5.0])
    assert np.isclose(spearman(a, a ** 3), 1.0)
    assert np.isclose(spearman(a, -a), -1.0)


def test_point_metrics():
    teams = ["CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RCB", "RR", "SRH"]
    pred = pd.DataFrame({"p_sold": [0.9, 0.2], "median": [200.0, 50.0], "p10": [150.0, 30], "p90": [300.0, 80]})
    for i, t in enumerate(teams):
        pred[t] = [0.5 if t == "KKR" else 0.05, 0.0]
    act = pd.DataFrame({"sold": [True, False], "team": ["KKR", None], "price": [400.0, np.nan]})
    m = point(pred, act)
    assert np.isclose(m["mae"], np.log(2))
    assert m["cover80"] == 0.0
    assert m["top3"] == 1.0
    assert m["auc"] == 1.0


def test_paired_difference_of_identical_models_is_zero():
    from analysis.metrics import paired
    rng = np.random.default_rng(0)
    pred = pd.DataFrame({"p_sold": rng.random(40), "median": rng.uniform(30, 900, 40),
                         "p10": 20.0, "p90": 1000.0})
    act = pd.DataFrame({"sold": rng.random(40) < 0.4, "team": None, "price": rng.uniform(30, 900, 40)})
    d = paired(pred, pred, act, reps=50)
    assert all(v["diff"] == 0 and v["lo"] == 0 and v["hi"] == 0 for v in d.values())


def test_top3_ties_share_credit_and_zero_gets_none():
    from analysis.metrics import TEAMS, top3_hit
    probs = np.zeros(10)
    assert top3_hit(probs, "CSK") == 0.0                      # a buyer given no chance earns nothing
    probs[[3, 5]] = [0.5, 0.3]
    probs[[0, 1]] = 0.1                                       # CSK and DC tie for third
    assert top3_hit(probs, "KKR") == 1.0
    assert top3_hit(probs, "CSK") == 0.5
