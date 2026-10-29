"""Map every player name in the auction and retained-squad files to a Cricsheet identifier.

    python -m pipeline.register      # rebuild data/auctions/name_map.csv + unmatched.csv

Inputs: the auction / pool / retained files in data/auctions (never the 2026 results), player_meta,
the Cricsheet register (people.csv, names.csv) and the IPL scorecards in data/raw/cricsheet/ipl.zip.

Matching is conservative: a name gets an ID only when the evidence points to exactly one person,
because a wrong ID (someone else's ball-by-ball record) is worse than none. Evidence, strongest first:

1. ``data/auctions/name_overrides.csv`` - hand-checked rows (blank ``cricsheet_id`` blocks a match);
2. ``dob``: date of birth from the official BCCI lists equals player_meta's (or day and month
   swapped), with a compatible name (initials, spelling variants and word order tolerated);
3. ``squad``: the player appears under a compatible name in the IPL scorecards of the team and season
   he was bought for / retained by. Only scorecards dated before the data cutoff are read.
4. ``dob~`` (DOB one character off), ``dob+partial-name`` (same DOB, country and first name),
   ``name+country`` / ``name`` / ``name-tokens`` (a unique exact or full-name match).

Finally one Cricsheet id may serve several spellings of one person but never two people.

Some different people share a name in our files (two Akash Singhs, two Shashank Singhs, ...). For those
the bare name is *not* a key; use ``"name|YYYY-MM-DD"`` (date of birth as in the auction file) or, for
retained-squad rows, ``"name|retained_YYYY|TEAM"``. ``lookup()`` does this for you.
"""
from __future__ import annotations

import json
import re
import unicodedata
import zipfile
from collections import defaultdict
from difflib import SequenceMatcher

import pandas as pd

from config import CFG, ROOT

AUC = ROOT / "data" / "auctions"
RAW = ROOT / "data" / "raw"
SOURCES = {  # file tag -> path
    "auction_2022": AUC / "auction_2022.csv",
    "auction_2023": AUC / "auction_2023.csv",
    "auction_2024": AUC / "auction_2024.csv",
    "auction_2025": AUC / "auction_2025.csv",
    "pool_2026": AUC / "pool_2026.csv",
    "retained_2024": AUC / "retained_2024.csv",
    "retained_2026": AUC / "retained_2026.csv",
}
OVERRIDES = AUC / "name_overrides.csv"
NAME_MAP = AUC / "name_map.csv"
UNMATCHED = AUC / "unmatched.csv"
IPL_TEAMS = {
    "Chennai Super Kings": "CSK", "Delhi Capitals": "DC", "Gujarat Titans": "GT",
    "Kolkata Knight Riders": "KKR", "Lucknow Super Giants": "LSG", "Mumbai Indians": "MI",
    "Punjab Kings": "PBKS", "Rajasthan Royals": "RR", "Royal Challengers Bangalore": "RCB",
    "Royal Challengers Bengaluru": "RCB", "Sunrisers Hyderabad": "SRH",
}
COUNTRY = {"usa": "united states of america", "uae": "united arab emirates",
           "u a e": "united arab emirates", "netherland": "netherlands"}
FIRST_NAME = {"md": "mohammed", "mohd": "mohammed", "mohammad": "mohammed", "muhammad": "mohammed",
              "mohamed": "mohammed"}


# ----------------------------------------------------------------------------------------- text
def norm(s) -> str:
    """Lower-case, accents and punctuation stripped, one space between tokens."""
    if not isinstance(s, str):
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[’'`]", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def tokens(s) -> list[str]:
    toks = norm(s).split()
    toks = [FIRST_NAME.get(t, t) for t in toks]
    out, buf = [], ""
    for t in toks:  # "k s bharat" -> "ks bharat" (initials written with dots)
        if len(t) == 1:
            buf += t
        else:
            if buf:
                out.append(buf)
                buf = ""
            out.append(t)
    if buf:
        out.append(buf)
    return out


def key_of(s) -> str:
    return " ".join(tokens(s))


def squash(s) -> str:
    return key_of(s).replace(" ", "")


def similar(a: str, b: str) -> bool:
    if a == b:
        return True
    return min(len(a), len(b)) >= 5 and SequenceMatcher(None, a, b).ratio() >= 0.85


def tokens_within(small: list[str], big: list[str]) -> bool:
    """Every token of `small` matches a distinct token of `big`; a 1-2 letter token is read as
    initials and matches that many words by their first letters ("ks" ~ "konidela srikar")."""
    pool = list(big)
    for t in small:
        hit = next((b for b in pool if similar(t, b)), None)
        if hit is not None:
            pool.remove(hit)
            continue
        if len(t) <= 2:
            for letter in t:
                w = next((b for b in pool if b[0] == letter), None)
                if w is None:
                    return False
                pool.remove(w)
            continue
        return False
    return True


def dob_relation(a: str, b: str) -> str:
    """'exact', 'near' (day/month swapped or one character off), 'conflict' or 'unknown'."""
    if not a or not b or not isinstance(b, str):
        return "unknown"
    if a == b:
        return "exact"
    ya, ma, da = a.split("-")
    yb, mb, db = b.split("-")
    if ya == yb and ma == db and da == mb:
        return "near"
    if len(a) == len(b) and sum(x != y for x, y in zip(a, b)) == 1:
        return "near"
    return "conflict"


def same_dob(a: str, b: str) -> bool:
    return dob_relation(a, b) in ("exact", "near")


def country_key(s) -> str:
    k = norm(s)
    return COUNTRY.get(k, k)


# ------------------------------------------------------------------------------------- reference
class Reference:
    """player_meta + Cricsheet register + IPL squad sheets, indexed for lookups."""

    def __init__(self):
        meta = pd.read_csv(ROOT / "data" / "player_meta.csv", dtype=str)
        meta = meta.apply(lambda c: c.str.strip() if c.dtype == object else c)
        self.meta = meta.drop_duplicates("cricsheet_id").set_index("cricsheet_id")
        people = pd.read_csv(RAW / "register" / "people.csv", dtype=str)
        variants = pd.read_csv(RAW / "register" / "names.csv", dtype=str)
        self.reg_name = dict(zip(people["identifier"], people["unique_name"]))

        self.exact = defaultdict(set)      # key_of(name) -> ids
        self.squashed = defaultdict(set)   # squash(name) -> ids
        self.by_token = defaultdict(set)   # any full-name token -> ids
        self.by_dob = defaultdict(set)     # dob -> ids
        self.full_tokens = {}              # id -> tokens of the longest known name
        self.forms = defaultdict(list)     # id -> token lists of its own names (meta / people.csv)
        self.variants = defaultdict(list)  # id -> token lists of names.csv variants (weaker evidence)
        for pid, r in self.meta.iterrows():
            for col in ("full_name", "name", "unique_name"):
                self._add(pid, r.get(col))
            full = r.get("full_name") if isinstance(r.get("full_name"), str) else r.get("unique_name")
            self.full_tokens[pid] = tokens(full)
            for t in self.full_tokens[pid]:
                self.by_token[t].add(pid)
            if isinstance(r.get("dob"), str):
                self.by_dob[r["dob"]].add(pid)
        for pid, a, b in zip(people["identifier"], people["name"], people["unique_name"]):
            self._add(pid, a)
            self._add(pid, b)
        for pid, a in zip(variants["identifier"], variants["name"]):
            self._add(pid, a, variant=True)
        self.rosters = self._ipl_rosters()

    def _add(self, pid, name, variant=False):
        if isinstance(name, str) and name.strip():
            self.exact[key_of(name)].add(pid)
            self.squashed[squash(name)].add(pid)
            t = tokens(name)
            store = self.variants if variant else self.forms
            if t and t not in store[pid]:
                store[pid].append(t)

    @staticmethod
    def _ipl_rosters() -> dict[tuple[int, str], dict[str, str]]:
        """(season, team) -> {cricsheet id: scorecard name} from IPL scorecards dated before the
        data cutoff (no match on or after 16 Dec 2025 is read, not even for identity)."""
        rosters = defaultdict(dict)
        path = RAW / "cricsheet" / "ipl.zip"
        if not path.exists():
            return rosters
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                if not n.endswith(".json"):
                    continue
                info = json.loads(z.read(n))["info"]
                if info["dates"][0] >= CFG["data"]["cutoff"]:
                    continue
                season = int(str(info["season"])[:4])
                reg = info.get("registry", {}).get("people", {})
                for team, players in info.get("players", {}).items():
                    code = IPL_TEAMS.get(team)
                    for p in players:
                        if code and p in reg:
                            rosters[(season, code)][reg[p]] = p
        return rosters

    def info(self, pid) -> dict:
        if pid in self.meta.index:
            r = self.meta.loc[pid]
            return {"name": r.get("full_name"), "country": r.get("country"), "dob": r.get("dob")}
        return {"name": self.reg_name.get(pid), "country": None, "dob": None}


# ----------------------------------------------------------------------------------------- input
def load_records() -> pd.DataFrame:
    """One row per player row in the source files, with the context used for matching."""
    rows = []
    for tag, path in SOURCES.items():
        df = pd.read_csv(path, dtype=str).fillna("")
        kind, year = tag.split("_")
        year = int(year)
        for i, r in df.iterrows():
            ctx = []  # (season, team) squads this person should appear in
            if kind == "auction" and r.get("status", "sold") == "sold" and r.get("team"):
                ctx.append((year, r["team"]))
            elif kind == "pool" and r.get("team_2025"):
                ctx.append((2025, r["team_2025"]))
            elif kind == "retained":
                ctx += [(year - 1, r["team"]), (year, r["team"])]
            rows.append({"file": tag, "row": i, "name": r["name"], "dob": r.get("dob", ""),
                         "country": r.get("country", ""), "team": r.get("team", ""),
                         "overseas": r.get("overseas", ""), "ctx": ctx})
    return pd.DataFrame(rows)


def cluster(records: pd.DataFrame) -> list[dict]:
    """Group rows into people: same normalised name and compatible DOB; DOB-less rows join the only
    candidate, or the one sharing a team/season context, else stay on their own."""
    people = []
    for _, grp in records.groupby(records["name"].map(key_of), sort=False):
        groups: list[dict] = []
        for r in grp[grp["dob"] != ""].to_dict("records"):
            g = next((g for g in groups if any(same_dob(r["dob"], d) for d in g["dobs"])), None)
            if g is None:
                g = {"rows": [], "dobs": set()}
                groups.append(g)
            g["rows"].append(r)
            g["dobs"].add(r["dob"])
        for r in grp[grp["dob"] == ""].to_dict("records"):  # retained-squad rows carry no DOB
            if len(groups) == 1:
                groups[0]["rows"].append(r)
                continue
            teams = {t for _, t in r["ctx"]} | ({r["team"]} if r["team"] else set())
            linked = [g for g in groups if any(t in teams for x in g["rows"] for _, t in x["ctx"])]
            if len(linked) == 1:
                linked[0]["rows"].append(r)
            elif not groups:
                groups.append({"rows": [r], "dobs": set()})
            else:
                groups.append({"rows": [r], "dobs": set(), "unresolved": True})
        for g in groups:
            g["ambiguous_name"] = len(groups) > 1
        people += groups
    return people


# -------------------------------------------------------------------------------------- matching
def loose(a: str, b: str) -> bool:
    """Token agreement used once a birthday or a squad sheet anchors the match: equal, one a
    prefix/suffix of the other (gus/angus, vijay/vijaykumar) or a close spelling with the same
    first letter (verma/varma, ahamad/ahmed)."""
    if a == b:
        return True
    if min(len(a), len(b)) >= 3 and (a.startswith(b) or b.startswith(a) or a.endswith(b) or b.endswith(a)):
        return True
    return min(len(a), len(b)) >= 4 and a[0] == b[0] and SequenceMatcher(None, a, b).ratio() >= 0.72


def name_score(listed: list[str], form: list[str], match=loose) -> float:
    """How well a known name form fits a listed name: 0 = incompatible, else 1 per whole-word pair
    and 0.5 per initial. One side's tokens must all pair up; a bare surname proves nothing. An initial
    stands for the first remaining given name or for the surname (R Smaran = Ravichandaran Smaran);
    further letters of the same initials are optional middle names."""
    best = 0.0
    for small, big in ((listed, form), (form, listed)):
        if len(small) == 1 and len(big) > 1:
            continue
        pool, score, ok = list(big), 0.0, True
        for t in small:
            hit = next((b for b in pool if match(t, b)), None)
            if hit is not None:
                pool.remove(hit)
                score += 1
                continue
            if len(t) > 3:
                ok = False
                break
            anchors = pool[:1] + ([big[-1]] if big[-1] in pool[1:] else [])
            hit = next((b for b in anchors if b[0] == t[0]), None)
            if hit is None:
                ok = False
                break
            pool.remove(hit)
            score += 0.5
            for ch in t[1:]:
                if len(pool) > 1 and pool[0][0] == ch:
                    pool.pop(0)
                    score += 0.5
        if ok and score >= 1:
            best = max(best, score)
    if not best and len(listed) > 1 and sorted("".join(listed)) == sorted("".join(form)):
        best = 1.0  # same letters, words split or ordered differently (vyshak vijay kumar)
    return best


def swapped(d: str) -> str:
    y, m, dd = d.split("-")
    return f"{y}-{dd}-{m}"


def decide(ref: Reference, person: dict) -> tuple[str, str, str]:
    """-> (cricsheet_id or '', method, note). Tiers: A same birthday, B IPL squad sheet,
    A' birthday + one shared name word, C name only. See the module docstring."""
    rows = person["rows"]
    listed = [tokens(n) for n in {r["name"] for r in rows}]
    dobs = person["dobs"]
    countries = {country_key(r["country"]) for r in rows if r["country"]}
    flags = {r["overseas"] for r in rows if r.get("overseas") in ("0", "1")}

    def country_ok(pid):
        c = ref.info(pid)["country"]
        if not isinstance(c, str) or not c:
            return True
        c = country_key(c)
        if countries:
            return c in countries
        if len(flags) == 1:
            return (c == "india") == (flags == {"0"})
        return True

    def dob_rel(pid):
        rank = {"unknown": 0, "conflict": 1, "near": 2, "exact": 3}
        return max((dob_relation(d, ref.info(pid)["dob"]) for d in dobs), key=rank.get, default="unknown")

    def score(pid, match=loose):  # a names.csv variant counts a little less than the player's own names
        own = max((name_score(l, f, match) for l in listed for f in ref.forms.get(pid, [])), default=0.0)
        var = max((name_score(l, f, match) for l in listed for f in ref.variants.get(pid, [])), default=0.0)
        return max(own, 0.9 * var)

    def best(scored):
        top = max(scored.values())
        return sorted(p for p, v in scored.items() if v == top)

    # A. same birthday (or day/month swapped) in player_meta, compatible name and country
    pool = set()
    for d in dobs:
        pool |= ref.by_dob.get(d, set()) | ref.by_dob.get(swapped(d), set())
    a_scored = {p: score(p) for p in pool}
    # a different country is allowed only for an exact birthday and a full-name agreement
    # (players who changed teams: Unmukt Chand India -> USA, Daniel Worrall Australia -> England)
    a_scored = {p: v for p, v in a_scored.items()
                if v > 0 and (country_ok(p) or (v >= 2 and dob_rel(p) == "exact"))}
    by_dob = best(a_scored) if a_scored else []
    # B. Cricsheet IPL squad sheets for the teams/seasons the player was bought for or retained by;
    #    a name that only half agrees (initial + surname) must not contradict the listed birthday
    ctx = sorted({c for r in rows for c in r["ctx"]})
    squad = {}
    for season, team in ctx:
        for pid in ref.rosters.get((season, team), {}):
            squad.setdefault(pid, f"squad {season} {team}")
    b_scored = {p: score(p) for p in squad if country_ok(p)}
    b_scored = {p: v for p, v in b_scored.items() if v > 0 and (v >= 2 or dob_rel(p) != "conflict")}
    in_squad = best(b_scored) if b_scored else []
    if len(by_dob) == 1 and len(in_squad) == 1 and by_dob[0] != in_squad[0]:
        return "", "ambiguous", f"DOB says {by_dob[0]}, squad sheet says {in_squad[0]}"
    if len(by_dob) == 1:
        extra = f"; {squad[by_dob[0]]}" if by_dob[0] in squad else ""
        return by_dob[0], "dob", "DOB + name" + extra
    if len(by_dob) > 1:
        return "", "ambiguous", "same DOB, similar names: " + ", ".join(by_dob)
    if len(in_squad) == 1:
        pid = in_squad[0]
        differs = dob_rel(pid) == "conflict"
        note = squad[pid] + (f" (listed DOB differs from player_meta {ref.info(pid)['dob']})" if differs else "")
        return pid, "squad", note
    if len(in_squad) > 1:
        return "", "ambiguous", "several squad matches: " + ", ".join(in_squad)
    # A'. same exact birthday + same country + same first name (Abhinav Sadarangani = Abhinav Manohar)
    firsts = {l[0] for l in listed if len(l) > 1 and len(l[0]) >= 4}
    partial = set()
    for d in dobs:
        for p in ref.by_dob.get(d, set()):
            c = ref.info(p)["country"]
            if not (isinstance(c, str) and countries and country_key(c) in countries):
                continue
            if any(form[0] in firsts for form in ref.forms.get(p, []) if len(form) > 1):
                partial.add(p)
    if len(partial) == 1:
        return partial.pop(), "dob+partial-name", "same DOB and country, one name word shared"
    # C. name only: exact / variant / squashed spelling, or every listed token inside the full name
    cands = set()
    for n in {r["name"] for r in rows}:
        cands |= ref.exact.get(key_of(n), set()) | ref.squashed.get(squash(n), set())
    exact = set(cands)
    for l in listed:
        if len(l) >= 2:
            for pid in set().union(*(ref.by_token.get(t, set()) for t in l)):
                if tokens_within(l, ref.full_tokens.get(pid, [])):
                    cands.add(pid)
    rel = {pid: dob_rel(pid) for pid in cands}
    conflicts = sorted(p for p in cands if rel[p] == "conflict")
    alive = [p for p in cands if rel[p] != "conflict" and country_ok(p)]
    note = ("DOB differs from " + ", ".join(conflicts)) if conflicts else ""
    near = [p for p in alive if rel[p] == "near" and score(p, similar) >= 1]
    if len(near) == 1:
        return near[0], "dob~", f"name + DOB one character / day-month off ({ref.info(near[0])['dob']})"
    if dobs:  # birthday known but nothing dated: only a lone, undated, same-country exact name
        undated = [p for p in alive if rel[p] == "unknown" and p in exact and countries
                   and isinstance(ref.info(p)["country"], str) and country_key(ref.info(p)["country"]) in countries]
        if len(undated) == 1 and len(alive) == 1:
            return undated[0], "name+country", "exact name, no DOB in player_meta"
        return "", "unmatched", note
    ex = sorted(p for p in alive if p in exact)
    if len(ex) == 1:
        return ex[0], "name", "exact name"
    if len(ex) > 1:
        return "", "ambiguous", "several exact names: " + ", ".join(ex)
    tk = sorted(alive)
    if len(tk) == 1:
        return tk[0], "name-tokens", "listed name tokens inside full name"
    if len(tk) > 1:
        return "", "ambiguous", "several full-name matches: " + ", ".join(tk)
    return "", "unmatched", note


STRENGTH = {"override": 9, "dob": 8, "squad": 7, "dob~": 6, "dob+partial-name": 5, "name+country": 4,
            "name": 3, "name-tokens": 2}


def one_person_per_id(people: list[dict]) -> None:
    """A Cricsheet id may serve several spellings of one person, never two people: when names
    holding the same id do not agree, the strongest evidence keeps it (a tie keeps nobody)."""
    def same_person(a: dict, b: dict) -> bool:
        na = [tokens(r["name"]) for r in a["rows"]]
        nb = [tokens(r["name"]) for r in b["rows"]]
        names_agree = any(x == y or name_score(x, y) >= 1 or set(w for w in x if len(w) >= 4) & set(y)
                          for x in na for y in nb)
        if a["dobs"] and b["dobs"]:  # both birthdays listed: they must agree, and so must one name word
            return names_agree and any(same_dob(x, y) for x in a["dobs"] for y in b["dobs"])
        return names_agree

    holders = defaultdict(list)
    for p in people:
        if p["id"]:
            holders[p["id"]].append(p)
    for pid, ps in holders.items():
        if len(ps) < 2:
            continue
        if all(same_person(a, b) for a in ps for b in ps if a is not b):
            continue  # one person spelled differently in different lists (R. Ashwin / Ravichandaran Ashwin)
        top = max(STRENGTH.get(p["method"], 0) for p in ps)
        keep = [p for p in ps if STRENGTH.get(p["method"], 0) == top]
        for p in ps:
            if p["method"] == "override":
                continue
            if p not in keep or len(keep) > 1:
                other = ", ".join(sorted({r["name"] for q in ps if q is not p for r in q["rows"]}))
                p["id"], p["method"], p["note"] = "", "ambiguous", f"id {pid} also matched to {other}"


# ------------------------------------------------------------------------------------------- run
def person_keys(person: dict) -> list[str]:
    """Dictionary keys this person is reachable by (see module docstring)."""
    names = sorted({r["name"] for r in person["rows"]})
    if not person["ambiguous_name"]:
        return names
    keys = []
    for r in person["rows"]:
        if r["dob"]:
            keys.append(f"{r['name']}|{r['dob']}")
        elif r["file"].startswith("retained"):
            keys.append(f"{r['name']}|{r['file']}|{r['team']}")
        else:
            keys.append(f"{r['name']}|{r['file']}|row{r['row']}")
    return sorted(set(keys))


def build() -> tuple[pd.DataFrame, pd.DataFrame]:
    ref = Reference()
    records = load_records()
    people = cluster(records)
    overrides = {}
    if OVERRIDES.exists():
        ov = pd.read_csv(OVERRIDES, dtype=str).fillna("")
        overrides = {r["name"]: (r["cricsheet_id"], r["evidence"]) for _, r in ov.iterrows()}
    for p in people:
        keys = person_keys(p)
        ov = next((overrides[k] for k in keys + sorted({r["name"] for r in p["rows"]}) if k in overrides), None)
        if ov is not None:
            p["id"], p["method"], p["note"] = ov[0], ("override" if ov[0] else "override:unmatched"), ov[1]
        elif p.get("unresolved"):
            p["id"], p["method"], p["note"] = "", "ambiguous", "same name as another listed player; no DOB or team link"
        else:
            p["id"], p["method"], p["note"] = decide(ref, p)
    one_person_per_id(people)
    out, miss = [], []
    for p in people:
        files = ";".join(sorted({r["file"] for r in p["rows"]}))
        dob = ";".join(sorted(p["dobs"]))
        for k in person_keys(p):
            row = {"name": k.split("|")[0], "cricsheet_id": p["id"], "method": p["method"] if p["id"] else "",
                   "key": k, "dob": dob, "files": files, "evidence": p["note"]}
            out.append(row)
            if not p["id"]:
                miss.append({"name": row["name"], "key": k, "dob": dob, "files": files,
                             "reason": p["method"] or "unmatched", "detail": p["note"]})
    name_map = pd.DataFrame(out).drop_duplicates("key").sort_values(["name", "key"])
    unmatched = pd.DataFrame(miss).drop_duplicates("key").sort_values(["name", "key"])
    return name_map, unmatched


def load_name_map() -> dict[str, str]:
    """key -> Cricsheet identifier, for matched players only (see module docstring for keys)."""
    nm = pd.read_csv(NAME_MAP, dtype=str).fillna("")
    nm = nm[nm["cricsheet_id"] != ""]
    return dict(zip(nm["key"], nm["cricsheet_id"]))


def lookup(name: str, dob: str = "", file: str = "", team: str = "", ids: dict | None = None) -> str | None:
    """Cricsheet id for a row: tries 'name|dob', then 'name|file|team', then the bare name."""
    ids = load_name_map() if ids is None else ids
    for k in (f"{name}|{dob}" if dob else None, f"{name}|{file}|{team}" if file and team else None, name):
        if k and ids.get(k):
            return ids[k]
    return None


def main() -> None:
    name_map, unmatched = build()
    name_map.to_csv(NAME_MAP, index=False, lineterminator="\n")
    unmatched.to_csv(UNMATCHED, index=False, lineterminator="\n")
    ids = dict(zip(name_map["key"], name_map["cricsheet_id"]))
    print(f"name_map.csv: {len(name_map)} keys, {int((name_map['cricsheet_id'] != '').sum())} matched; "
          f"unmatched.csv: {len(unmatched)}")
    print(name_map.loc[name_map["cricsheet_id"] != "", "method"].value_counts().to_string())
    for tag, path in SOURCES.items():
        df = pd.read_csv(path, dtype=str).fillna("")
        hit = [bool(lookup(r["name"], r.get("dob", ""), tag, r.get("team", ""), ids)) for _, r in df.iterrows()]
        sold = df.get("status", pd.Series(["sold"] * len(df))) == "sold"
        extra = f", sold rows {sum(h for h, s in zip(hit, sold) if s)}/{int(sold.sum())}" if "status" in df else ""
        print(f"  {tag:14s} rows matched {sum(hit)}/{len(df)} ({sum(hit) / len(df):.0%}){extra}")


if __name__ == "__main__":
    main()
