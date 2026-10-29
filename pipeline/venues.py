"""Venues: canonical names, home-ground profiles and home weights.

A ground is described by its IPL scoring profile relative to the IPL average over the same
window: runs per over, boundary rate, pace and spin economy, and the spin share of
bowler wickets. Teams with two grounds weight each by IPL games hosted in the last season.
"""
import numpy as np
import pandas as pd

from config import CFG

ALIASES = {
    "ACA Stadium": "Barsapara Cricket Stadium",
    "Feroz Shah Kotla": "Arun Jaitley Stadium",
    "M.Chinnaswamy Stadium": "M Chinnaswamy Stadium",
    "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium B":
        "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium",
    "Sardar Patel Stadium": "Narendra Modi Stadium",
}
SHORT = {  # display names
    "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium": "Ekana Stadium",
    "Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium": "ACA-VDCA Stadium",
    "Maharaja Yadavindra Singh International Cricket Stadium": "Mullanpur Stadium",
    "Himachal Pradesh Cricket Association Stadium": "HPCA Stadium",
    "Punjab Cricket Association IS Bindra Stadium": "IS Bindra Stadium",
    "Rajiv Gandhi International Stadium": "Rajiv Gandhi Intl. Stadium",
}
TEAM_NAMES = {
    "Chennai Super Kings": "CSK", "Delhi Capitals": "DC", "Delhi Daredevils": "DC",
    "Gujarat Titans": "GT", "Kolkata Knight Riders": "KKR", "Lucknow Super Giants": "LSG",
    "Mumbai Indians": "MI", "Punjab Kings": "PBKS", "Kings XI Punjab": "PBKS",
    "Royal Challengers Bangalore": "RCB", "Royal Challengers Bengaluru": "RCB",
    "Rajasthan Royals": "RR", "Sunrisers Hyderabad": "SRH",
}
WICKET_KINDS = {"bowled", "caught", "lbw", "stumped", "caught and bowled", "hit wicket"}


def canon(venue: str) -> str:
    name = str(venue).split(",")[0].strip()
    return ALIASES.get(name, name)


def profiles(d: pd.DataFrame, w: np.ndarray) -> pd.DataFrame:
    """Recency-weighted IPL scoring profile per venue (both teams' bowling), with each stat's
    gap to the IPL average.

    d: IPL deliveries with columns venue_c, legal, boundary, conceded, is_spin, bowler_wkt.
    """
    x = d.assign(w=w)
    x["wl"] = x.w * x.legal
    x["wr"] = x.w * x.r_total
    x["wb"] = x.w * x.boundary
    x["wkt"] = x.w * x.bowler_wkt
    x["spin_c"] = x.w * x.conceded * x.is_spin
    x["pace_c"] = x.w * x.conceded * ~x.is_spin
    x["spin_l"] = x.wl * x.is_spin
    x["pace_l"] = x.wl * ~x.is_spin
    x["spin_w"] = x.wkt * x.is_spin
    cols = ["wl", "wr", "wb", "wkt", "spin_c", "pace_c", "spin_l", "pace_l", "spin_w"]
    g = x.groupby("venue_c", observed=True)[cols].sum()
    tot = g[cols].sum()

    def stats(s):
        return pd.DataFrame({
            "rpo": 6 * s.wr / s.wl,
            "boundary_pct": 100 * s.wb / s.wl,
            "spin_econ": 6 * s.spin_c / s.spin_l,
            "pace_econ": 6 * s.pace_c / s.pace_l,
            "spin_wkt_share": s.spin_w / s.wkt,
        })

    out = stats(g)
    league = stats(tot.to_frame().T).iloc[0]
    # Spin edge (runs/over): how much better spin does here than pace, versus the IPL average.
    out["spin_edge"] = (league.spin_econ - out.spin_econ) - (league.pace_econ - out.pace_econ)
    out["boundary_edge"] = out.boundary_pct - league.boundary_pct
    out.attrs["league"] = league
    return out


def home_grounds(d_ipl: pd.DataFrame, prof: pd.DataFrame, asof: str) -> dict[str, list[dict]]:
    """Each team's home grounds, weighted by IPL games it hosted there in the last season."""
    last = d_ipl[d_ipl.date < asof].date.dt.year.max()
    season = d_ipl[d_ipl.date.dt.year == last]
    games = season.groupby("mid", observed=True).agg(venue_c=("venue_c", "first"),
                                                     teams=("team_bat", lambda t: set(t)))
    out = {}
    for team, venues in CFG["home"].items():
        counts = {v: int(sum(1 for _, r in games.iterrows()
                             if r.venue_c == v and team in {TEAM_NAMES.get(t) for t in r.teams}))
                  for v in venues}
        total = sum(counts.values()) or 1
        out[team] = [{
            "venue": SHORT.get(v, v), "full": v, "weight": round(n / total, 3), "games": n,
            **{k: round(float(prof.loc[v, k]), 3) for k in
               ("rpo", "boundary_pct", "spin_econ", "pace_econ", "spin_wkt_share", "spin_edge", "boundary_edge")},
        } for v, n in counts.items() if n > 0 and v in prof.index]
    return out


def describe(g: dict) -> str:
    """One-line plain-English note for a ground profile."""
    spin = "spin-friendly" if g["spin_edge"] > 0.3 else "pace-friendly" if g["spin_edge"] < -0.3 else "balanced"
    bnd = ("high" if g["boundary_edge"] > 0.8 else "low" if g["boundary_edge"] < -0.8 else "average")
    return f"{spin.capitalize()}, {bnd} boundary rate"
