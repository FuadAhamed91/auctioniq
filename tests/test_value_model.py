import numpy as np
import pandas as pd

from analysis.value_model import ValueModel


def test_tobit_recovers_effects_despite_censoring():
    rng = np.random.default_rng(1)
    n = 4000
    x1, x2 = rng.normal(size=n), rng.normal(size=n)
    latent = 1.0 + 0.8 * x1 - 0.5 * x2 + rng.normal(0, 0.6, n)
    floor = np.full(n, 0.9)                      # "base price": below it a player goes unsold
    sold = latent >= floor
    df = pd.DataFrame({"x1": x1, "x2": x2, "y": np.where(sold, latent, floor), "sold": sold})
    m = ValueModel(["x1", "x2"], lam=0.0).fit(df)
    slope = m.beta[1:] / m.sd
    assert abs(slope[0] - 0.8) < 0.05 and abs(slope[1] + 0.5) < 0.05
    assert abs(m.sigma - 0.6) < 0.05

    naive = np.polyfit(x1[sold], latent[sold], 1)[0]  # dropping the unsold biases the slope
    assert abs(slope[0] - 0.8) < abs(naive - 0.8)


def test_interval_is_80_percent_wide():
    df = pd.DataFrame({"x": np.linspace(-1, 1, 50), "y": np.linspace(0, 1, 50), "sold": True})
    m = ValueModel(["x"], lam=1.0).fit(df)
    p = m.predict(df.head(1), 0.0)
    assert np.isclose(np.log(p.value_hi / p.value_mid), 1.2816 * m.sigma).all()
    assert (p.value_lo < p.value_mid).all() and (p.value_mid < p.value_hi).all()
