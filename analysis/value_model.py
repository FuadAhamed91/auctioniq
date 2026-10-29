"""Value model: expected log price with an 80% interval.

A censored (Tobit) ridge regression, fitted by EM. A sold player gives his log price; an unsold
player only tells us his price would have been below his base price. Prices are modelled
relative to the auction's money per open slot, so a richer auction lifts every value.
It is fitted only on auctions before the one being simulated.
"""
import math

import numpy as np
import pandas as pd

from config import CFG

V = CFG["value"]
Z80 = 1.2816  # standard normal quantile for an 80% interval
BASE_FEATURES = ["log_base", "has_prev", "log_prev", "overseas", "capped", "intl_caps", "age", "age2",
                 "pace", "spin", "allround", "keeper", "skill_z", "evidence", "ipl_exp"]
_erfc = np.frompyfunc(math.erfc, 1, 1)


def features(factors: set[str]) -> list[str]:
    extra = ["start_z"] if "start_speed" in factors else []
    return BASE_FEATURES + extra


def _mills(a: np.ndarray) -> np.ndarray:
    """φ(a)/Φ(a), stable for very negative a."""
    cdf = 0.5 * _erfc(-a / math.sqrt(2)).astype(float)
    pdf = np.exp(-0.5 * a * a) / math.sqrt(2 * math.pi)
    tail = a < -30
    return np.where(tail, -a, pdf / np.maximum(cdf, 1e-300))


class ValueModel:
    def __init__(self, cols: list[str], lam: float = V["ridge"]):
        self.cols, self.lam = cols, lam

    def _x(self, df: pd.DataFrame) -> np.ndarray:
        x = (df[self.cols].to_numpy(float) - self.mean) / self.sd
        return np.column_stack([np.ones(len(x)), x])

    def fit(self, df: pd.DataFrame) -> "ValueModel":
        """df: cols + `y` (log price / money per slot; for unsold, the log base on that scale)
        + `sold` (bool)."""
        self.mean = df[self.cols].mean().to_numpy(float)
        self.sd = df[self.cols].std().replace(0, 1).to_numpy(float)
        x, y, sold = self._x(df), df.y.to_numpy(float), df.sold.to_numpy(bool)
        pen = self.lam * np.eye(x.shape[1])
        pen[0, 0] = 0
        beta = np.linalg.solve(x.T @ x + pen, x.T @ y)
        sigma = float(np.std(y - x @ beta))
        for _ in range(V["em_iterations"]):
            mu = x @ beta
            a = (y - mu) / sigma  # for unsold, y is the censoring point
            lam = _mills(a)
            y_hat = np.where(sold, y, mu - sigma * lam)
            var = np.where(sold, 0.0, sigma ** 2 * (1 - a * lam - lam ** 2))
            beta = np.linalg.solve(x.T @ x + pen, x.T @ y_hat)
            sigma = float(np.sqrt(np.mean((y_hat - x @ beta) ** 2 + var)))
        self.beta, self.sigma = beta, sigma
        return self

    def predict(self, df: pd.DataFrame, log_mps: float) -> pd.DataFrame:
        """Model price (median) and 80% interval in lakhs for an auction with this money per slot."""
        mu = self._x(df) @ self.beta + log_mps
        return pd.DataFrame({
            "value_mid": np.exp(mu), "value_lo": np.exp(mu - Z80 * self.sigma),
            "value_hi": np.exp(mu + Z80 * self.sigma), "value_mu": mu,
        }, index=df.index)
