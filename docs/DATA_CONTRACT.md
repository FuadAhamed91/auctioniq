# Data contract: engine → web

Everything the app shows is precomputed by `python -m engine.export` into `web/public/data/`.
The app never computes model numbers itself; it only replays and formats them.

**Conventions**

- Money is always an integer number of **lakhs** (₹1 Cr = 100 L). Format in the UI as
  `₹75 L` below 100 and `₹1.25 Cr` from 100 up (two decimals, trailing zeros kept: `₹2.00 Cr`).
- Teams are always the codes `CSK DC GT KKR LSG MI PBKS RCB RR SRH`, in that order (index 0–9).
- Player `id` = index in `players.json` = position in the official 2026 auction list.
- Role keys (main role and second role):

| key | label |
|---|---|
| `pp_opener` | Powerplay opener |
| `anchor` | Anchor |
| `finisher` | Finisher |
| `pp_pacer` | Powerplay pacer |
| `death_pacer` | Death pacer |
| `wrist_spin` | Wrist spinner |
| `finger_spin` | Finger spinner |
| `pace_ar` | Pace all-rounder |
| `spin_ar` | Spin all-rounder |

- Bowler-type keys (matchups): `ra_pace`, `la_pace`, `off_spin`, `la_orth`, `leg_spin`, `la_wrist`.
- Run numbers (`feature[].run`, keys of `lots/{id}.json`) are **0-based** indices into `outcomes.bin`
  (run 0 is the first run stored). Show them 1-based in the UI: run 482 → "Run 483 of 1,000".
- Skill `rv` values are runs added **per ball** against the context average. Show them per 100 balls
  (`rv × 100`, one decimal, signed: "+12.0 runs / 100 balls").

## `meta.json`

```jsonc
{
  "title": "IPL 2026 mini-auction",
  "date": "2025-12-16", "city": "Abu Dhabi", "asOf": "2025-12-15",
  "runs": 1000, "seed": 20251216,
  "rules": {
    "increments": [[100, 5], [200, 10], [500, 20], [null, 25]], // [band upper bound, step]: the next bid is the next multiple of the band's step
    "minSquad": 18, "maxSquad": 25, "maxOverseas": 8,
    "overseasFeeCap": 1800,        // overseas player keeps at most this; the excess goes to the BCCI
    "reservePerSlot": 30           // purse kept back per unfilled minimum slot
  },
  "roles": [{ "key": "pp_opener", "label": "Powerplay opener" }],   // all 9, in the table order above
  "bowlerTypes": [{ "key": "ra_pace", "label": "Right-arm pace" }], // all 6
  "tags": { "wk": "Keeper", "lhb": "Left-handed bat", "lap": "Left-arm pace",
            "overseas": "Overseas", "uncapped": "Uncapped", "fast_start": "Fast starter" },
  "factors": ["needs"],                                // model factors switched on for this run (from the 2024 ablation)
  "teams": [{
    "code": "CSK",
    "purse": 4340, "slots": 9, "overseasSlots": 4, "squadSize": 16,
    "style": 1.04,                                   // spending-style factor from past auctions
    "home": [{ "venue": "MA Chidambaram Stadium", "weight": 1.0, "games": 6,
               "rpo": 8.1, "boundaryPct": 15.2, "spinEcon": 7.3, "paceEcon": 8.9, "spinWktShare": 0.48,
               "spinEdge": -0.03, "boundaryEdge": -3.5, "note": "Balanced, low boundary rate" }],
    "retained": [{ "name": "Ruturaj Gaikwad", "role": "anchor", "role2": "pp_opener",
                   "overseas": false, "tags": ["…"] }],
    "template": { "pp_opener": 2.8, "anchor": 2.4 },  // role counts for a 25-man squad (all 9 keys)
    "needs": [{ "role": "death_pacer", "kind": "depth", "score": 0.6,
                "text": "Death pacer: 1 of 2.6 template slots filled" }],  // kind: depth | keeper | weakness; role may be null
    "sim": {                                          // across all runs
      "spend":       { "p10": 3800, "median": 4200, "p90": 4340 },
      "purseLeft":   { "p10": 0,    "median": 140,  "p90": 540 },
      "bought":      { "p10": 7,    "median": 9,    "p90": 9 },
      "needsFilled": { "p10": 0.6,  "median": 0.83, "p90": 1.0 },  // share of pre-auction need score met
      "topTargets": [[12, 0.43], [40, 0.31]]          // [player id, P(this team buys him)], top 8
    }
  }],
  "validation": {                                      // 2024 back-test (tuning + ablation), shown in About
    "auction": "2024 mini-auction", "runs": 500, "ridge": 16, "weights": { "market_share": 0.9 },
    "rows": [{ "model": "+ needs", "mode": "value", "kept": true, "n": 332,   // mode: value | need_only | baseline
               "mae": 0.786, "spearman": 0.659, "auc": 0.727, "top3": 0.472, "cover80": 0.708, "need_hit": 0.764,
               "ci":    { "mae": [0.56, 1.05] },             // bootstrap 95% interval per metric
               "delta": { "mae": [-0.044, -0.09, 0.0] } }],  // vs the model it would replace: [diff, lo, hi], paired bootstrap
    "kept": ["needs", "matchups"], "dropped": ["start speed", "home fit"], "factors": ["matchups", "needs"],
    "needHit": { "est": 0.89, "base": 0.84, "top3": 0.45, "n": 72 },  // pre-auction needs vs real buyers (no simulation):
                                                        // est = buyer's gate open, base = any team's gate open for the
                                                        // same players, top3 = buyer among the three neediest teams
    "points": []                                        // see "Added fields (v2)"
  }
}
```

Metrics (all on the real 2024 auction, players in the 2024 list):
`mae` mean absolute error of natural-log price (real vs simulated median given sold; players sold in
reality); `spearman` rank correlation of the same two; `auc` how well P(sold) separates sold from unsold;
`top3` share of real buyers among the three teams that bought the player most often; `cover80` share of
real prices inside the simulated 10th–90th percentile range; `need_hit` share of real buys where the
buyer had a pre-auction need for the player. `kept` is null for the baseline and comparison rows.

### Added fields (v2)

```jsonc
// meta.validation also carries the 2024 back-test, one row per player in the 2024 list:
"points": [{ "name": "Mitchell Starc", "sold": true, "price": 2475,   // real 2024 outcome (null if unsold)
             "median": 1450, "p10": 900, "p90": 2300, "pSold": 0.97 }], // simulated with pre-auction data only
// meta.validation.valueBacktests: the value model alone on past auctions, each fitted only on earlier
// auctions of the same kind (no simulation). loglik: censored log-likelihood per player; mae / spearman:
// natural-log price error and rank correlation of the median price given a sale (sold players);
// auc: how well the chance of a sale separates sold from unsold
"valueBacktests": [{ "auction": 2025, "kind": "mega", "train": [2022], "n": 577, "n_sold": 182,
                     "loglik": -0.633, "mae": 0.590, "spearman": 0.856, "auc": 0.872 }],
// players[i].drivers: what lifts or lowers his value against the average player of past auctions of
// the same kind, grouped the way a scout talks (natural-log scale, largest first): history (last IPL
// auction price), pedigree (caps), form (skills, evidence, start speed), role, age, list (how far down
// the official list his set comes), base (base price), overseas
"drivers": [["history", 0.62], ["list", 0.31], ["age", -0.12]],
// players[i].skills.bat and .bowl also carry pp and death: his share of balls in the powerplay / at the death
// players[i].buzz: pre-auction signals for an uncapped player (data/research/buzz.csv), each cited:
// signal is watch (named one to watch) | trial (franchise trials; team = codes joined by ";") | league
"buzz": [{ "signal": "league", "team": "", "detail": "UP T20 2025: ...", "outlet": "Sportstar", "date": "2025-12-12", "url": "https://..." }],
// lots/{id}.json, per appearance: market.alike = comparable players of his role still in the pool besides
// him; market.short = teams that could buy him (a slot, and an overseas slot if needed) short of one.
// Per team decision, why = the cricket behind its interest: the role he would fill, how many the squad
// has there (have) against a usual IPL squad (usual), its best player there now (best), whether he is
// better (better), keepers on the books, and kind: depth | upgrade | keeper | weakness | fill
"market": { "alike": 2, "short": 6 },
"why": { "role": "death_pacer", "kind": "depth", "have": 1.0, "usual": 3.1, "best": "A Player",
         "better": true, "keepers": 2 },
// meta.teams[i].habits: what the franchise bought in the auctions on file, against the league (background
// only; the agents do not use it). items: clear differences only, largest first; keys vet (30+), youth
// (uncapped Indian, 23 or under), overseas, capped, spin, pace, allround, keeper, former (own former
// players), star (top 10% of an auction's prices). starSpend: [team, league] share of money on star buys
"habits": { "since": 2018, "buys": 96, "medianAge": 25.5,
            "items": [{ "key": "youth", "share": 0.2, "league": 0.14 }], "starSpend": [0.34, 0.44] },
// meta.teams[i].notes: cited background on the franchise's auction habits, all published before the auction
"notes": [{ "note": "...", "outlet": "ESPNcricinfo", "date": "2025-11-16", "url": "https://..." }],
// meta.highlights: auction-at-a-glance lists of player ids, computed from the 1,000 runs
"highlights": {
  "contested": [[12, 6.2]],   // most wanted: [id, average number of teams ready to pay at least his base]
  "priciest":  [[3, 2150]],   // highest median price: [id, median lakhs]
  "coinFlips": [[88, 0.51]]   // closest to a 50% chance of being sold: [id, pSold]
}
```

`players[].sim.noNeeds = { "pSold": 0.62, "median": 640 }` — the same player when teams bid on value
alone (no role needs, matchups or home fit), from a separate set of runs. `median` is null if never sold.

## `players.json`

Array in official list order (`id` = array index).

```jsonc
{
  "id": 0, "lot": 1, "set": 1, "setCode": "BA1",
  "name": "Cameron Green", "country": "Australia",
  "overseas": true, "capped": true, "age": 26, "base": 200,
  "role": "pace_ar", "role2": "anchor",              // role2 may be null
  "tags": ["overseas"],                               // keys of meta.tags
  "evidence": { "matches": 82, "batBalls": 1320, "bowlBalls": 980, "iplMatches": 29 },
  "skills": {   // runs added per ball (context-adjusted, IPL-equivalent), relative to the average regular
                // of the role group (0 = average T20 regular; + is better); pct is within the role group, null under 60 balls
    "bat":   { "rv": 0.12, "pct": 81, "balls": 1320, "sr": 148.2 },   // null when no evidence
    "bowl":  { "rv": 0.05, "pct": 62, "balls": 980,  "econ": 8.6 },
    "start": { "rv": 0.21, "balls": 310 },
    "vs": [{ "type": "ra_pace", "rv": 0.10, "balls": 620 }]          // six bowler types, balls may be 0
  },
  "value": { "mid": 950, "lo": 520, "hi": 1730 },     // model price and 80% interval
  "prev":  { "price": 1750, "team": "MI", "year": 2023 },   // last IPL auction price, or null
  "sim": {
    "pSold": 0.98, "pCalled": 1.0,
    "buyers": [["KKR", 0.43], ["CSK", 0.21]],         // P(buyer) over all runs, sorted, > 0 only
    "price": { "p10": 1450, "median": 1900, "p90": 2450, "mean": 1930 },  // given sold; null if never sold
    "hist": [[1400, 12], [1500, 31]],                  // [bin lower edge, runs], given sold
    "feature": [{ "run": 482 }, { "run": 17 }]
  }
}
```

`sim.feature` lists the runs replayed bid by bid: a seeded random draw of up to
`[montecarlo] featured` runs from the runs the player was called in (empty if he was never called).
They are a random draw, not the run nearest his median, so a replayed lot can land above or below
it. The app starts a lot on a random one of them and keeps the 1,000-run numbers sealed until the
hammer falls; "Show another run" steps through the rest. Every listed run has a lot log in
`lots/{id}.json`.

## `outcomes.bin`

Little-endian `Uint16` array, the sale order of every run:

```
[runs, players]
then for each run: [count, then count records of 4 values: player id, team index (65535 = unsold), price, round]
```

`round`: 0 = main sets, 1 = first accelerated round, 2 = later accelerated rounds. Unsold records
carry price 0. Records are in the
order the lots happened. A player not called in a run has no record. The purse and squad of every team
just before record `seq` = the starting state in `meta.json` plus all sold records `[0, seq)` of that run.

## `lots/{id}.json`

```jsonc
{
  "id": 12,
  "runs": {
    "482": [                                   // this player's appearances in run 482 (2 if he returned in an accelerated round)
      {
        "seq": 15, "round": 0, "start": 200,
        "teams": {                             // every team's decision at the moment the lot opened
          "CSK": {
            "open": true,
            "gate": [["need", true, "Death pacer · depth gap 1.6"], ["slot", true, "9 slots left"],
                     ["overseas", true, "4 overseas slots"], ["purse", true, "₹43.40 Cr, ₹2.10 Cr reserved"]],
            "walk": 1420,                      // walk-away price actually used (after cap / floor)
            "cap": 4310,                       // the most the team could bid (purse reserve rule)
            "floor": null,                     // base price when a last-round fill shortlist raised the walk-away to it
            "f": { "value": 950.0, "need": 1.32, "scarcity": 1.08, "pressure": 1.05,
                   "home": 1.0, "style": 1.04, "market": 1.21, "noise": 0.98 }
            // walk = value × need × … × noise (then capped / floored). market = how the whole room rates
            // him this run (shared by all teams); noise = this team's own draw. home is 1 when home fit is off.
          },
          "MI": { "open": false, "gate": [["overseas", false, "No overseas slot"]], "walk": null, "f": null }
        },
        "events": [
          ["open", "CSK", "Need · death pacer"],
          ["bid", "CSK", 200],
          ["bid", "KKR", 220],
          ["drop", "CSK", 1420, "Walk-away ₹14.20 Cr"],
          ["sold", "KKR", 1900]               // or ["unsold", "No bid at base"]
        ]
      }
    ]
  }
}
```

An empty appearance list means the player was never called in that run (no team nominated him).

Event types: `open` (gate opened, chip text), `bid` (team, price), `drop` (team, price it quit at, chip text),
`sold` (team, price), `unsold` (reason).
