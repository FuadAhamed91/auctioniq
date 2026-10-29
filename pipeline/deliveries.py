"""Parse Cricsheet ball-by-ball JSON (read straight from the zips) into one compact
delivery table, cached at .cache/deliveries.pkl.

Kept: men's 20-over T20 matches dated in [history_start, cutoff). T20Is are kept only
between two ICC full members. Super overs are dropped. Player names are replaced by
Cricsheet registry IDs.

    python -m pipeline.deliveries
"""
import json
import zipfile

import numpy as np
import pandas as pd

from config import CFG, ROOT

CACHE = ROOT / ".cache" / "deliveries.pkl"
FULL_MEMBERS = {
    "Afghanistan", "Australia", "Bangladesh", "England", "India", "Ireland",
    "New Zealand", "Pakistan", "South Africa", "Sri Lanka", "West Indies", "Zimbabwe",
}
COLUMNS = [
    "mid", "date", "comp", "venue", "inn", "team_bat", "team_bowl", "over",
    "legal_before", "wkts_before", "batter", "bowler", "non_striker", "bat_pos", "bat_ball",
    "r_bat", "wide", "noball", "r_total", "out_id", "kind",
]


def _keep(info: dict, comp: str) -> bool:
    if info.get("gender") != "male" or info.get("overs") != 20:
        return False
    if comp == "T20I":
        return set(info["teams"]) <= FULL_MEMBERS
    return True


def _match_rows(mid: int, comp: str, data: dict) -> list[tuple]:
    info = data["info"]
    people = info["registry"]["people"]
    date = info["dates"][0]
    venue = info.get("venue", "")
    rows = []
    for inn_no, inn in enumerate(data.get("innings", []), start=1):
        if inn.get("super_over") or inn_no > 2:
            continue
        team_bat = inn["team"]
        team_bowl = next(t for t in info["teams"] if t != team_bat)
        order: dict[str, int] = {}
        faced: dict[str, int] = {}
        legal = wkts = 0
        for over in inn.get("overs", []):
            for d in over["deliveries"]:
                bat, ns = people[d["batter"]], people[d["non_striker"]]
                for p in (bat, ns):
                    order.setdefault(p, len(order) + 1)
                extras = d.get("extras", {})
                wide, noball = extras.get("wides", 0), extras.get("noballs", 0)
                if not wide:
                    faced[bat] = faced.get(bat, 0) + 1
                out_id, kind = None, None
                if "wickets" in d:
                    w = d["wickets"][0]
                    out_id, kind = people.get(w["player_out"]), w["kind"]
                runs = d["runs"]
                rows.append((
                    mid, date, comp, venue, inn_no, team_bat, team_bowl, over["over"],
                    legal, wkts, bat, people[d["bowler"]], ns, order[bat], faced.get(bat, 0),
                    runs["batter"], wide, noball, runs["total"], out_id, kind,
                ))
                if not (wide or noball):
                    legal += 1
                if "wickets" in d:
                    wkts += len(d["wickets"])
    return rows


def parse_all() -> pd.DataFrame:
    start, cutoff = CFG["data"]["history_start"], CFG["data"]["cutoff"]
    rows: list[tuple] = []
    mid = 0
    for code, comp in CFG["data"]["competitions"].items():
        kept = 0
        with zipfile.ZipFile(ROOT / "data" / "raw" / "cricsheet" / f"{code}.zip") as z:
            for name in z.namelist():
                if not name.endswith(".json"):
                    continue
                data = json.loads(z.read(name))
                date = data["info"]["dates"][0]
                if not (start <= date < cutoff) or not _keep(data["info"], comp):
                    continue
                rows.extend(_match_rows(mid, comp, data))
                mid += 1
                kept += 1
        print(f"  {comp:12s} {kept:5d} matches")
    df = pd.DataFrame.from_records(rows, columns=COLUMNS)
    df["date"] = pd.to_datetime(df["date"])
    for col in ("comp", "venue", "team_bat", "team_bowl", "batter", "bowler",
                "non_striker", "out_id", "kind"):
        df[col] = df[col].astype("category")
    for col in ("inn", "over", "wkts_before", "bat_pos", "r_bat", "wide", "noball", "r_total"):
        df[col] = df[col].astype(np.int8)
    for col in ("legal_before", "bat_ball", "mid"):
        df[col] = df[col].astype(np.int32)
    return df


def load() -> pd.DataFrame:
    """The delivery table, parsed once and cached."""
    if CACHE.exists():
        return pd.read_pickle(CACHE)
    df = parse_all()
    CACHE.parent.mkdir(exist_ok=True)
    df.to_pickle(CACHE)
    return df


if __name__ == "__main__":
    CACHE.unlink(missing_ok=True)
    d = load()
    print(f"{len(d):,} deliveries, {d['mid'].nunique():,} matches, "
          f"{d['date'].min():%Y-%m-%d} to {d['date'].max():%Y-%m-%d}")
