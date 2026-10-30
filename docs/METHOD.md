# Method

Every number in AuctionIQ comes from data dated before the auction it describes. For the 2026
simulation that means matches before 16 Dec 2025, auctions up to the 2025 mega-auction, and the
pre-auction list, purses, slots and retained squads. The real 2026 results are read only by
`analysis/compare_2026.py`.

## 1. Skills (`pipeline/skills.py`)

**Runs added per ball.** Each ball is worth the runs it produced plus the change in run
expectancy (RE), the runs a side can still expect from that point. A wicket therefore costs what
it costs at that moment of the innings. RE comes from recency-weighted IPL first innings (two-year
half-life, so recent seasons dominate): each cell, smoothed over neighbouring balls, is shrunk toward
a fitted curve per wickets-down, `Z·(1 − exp(−balls left / L))` (the shape behind the DLS resource
table), and a weighted isotonic fit makes sure more wickets down never means more runs to come.

**Context.** Each ball is compared with the average for the same competition-season and phase
(powerplay, middle, death), and with the venue's park factor for that phase, shrunk toward its
competition average by 3,000 balls of prior.

**League strength.** Players who played both a league and the IPL bridge the two: the
harmonic-mean-weighted gap between their numbers there and in the IPL is that league's offset,
shrunk toward the pooled offset. Results are IPL-equivalent.

**Recency and shrinkage.** Balls are weighted by a two-year half-life. A player's quality is his
weighted mean shrunk toward the population mean by `k` balls, where `k = σ²_within / σ²_between`
is estimated from the data (about 1,500 balls for batting and 1,100 for bowling as of December 2025;
because `k` is in balls and older balls weigh less, older evidence is shrunk harder). Every estimate
keeps its ball count. In the app, skills are shown relative to the average T20 regular of the same
role group, so 0 means "an average regular".

**Roles from usage.** Phase shares of balls faced and bowled, batting position and balls per
match give each player a main role and, where the evidence supports it, a second role: powerplay
opener, anchor, finisher, powerplay pacer, death pacer, wrist spinner, finger spinner, pace
all-rounder, spin all-rounder. Players with fewer than 60 balls take their role from the listed
playing role and bowling style. Keeper is a tag.

**Tags.** Runs added against each of six bowler types (right-arm pace, left-arm pace, off-spin,
left-arm orthodox, leg-spin, left-arm wrist spin), shrunk toward the batter's own average; start
speed (runs above expectation in a batter's first ten balls, given the phase he came in, league
adjusted and shrunk on its own scale); keeper,
overseas, uncapped, left-handed bat, left-arm pace.

## 2. Home grounds (`pipeline/venues.py`)

Recency-weighted IPL profile of each ground: runs per over, boundary rate, pace and spin economy,
spin share of bowler wickets. `spin edge` = how much better spin does there than pace, against
the IPL average (runs per over). Teams with two grounds weight each by the IPL games they hosted
there in the last season.

## 3. Value model (`analysis/value_model.py`)

A censored (Tobit) ridge regression on log price, fitted by EM. Sold players give their price;
unsold players say only that their price was below their base. Prices are modelled relative to
the auction's money per open slot. Features: log base price, previous IPL auction price, overseas,
capped, international caps and career IPL caps (both printed on the official list), age, role group,
keeper, main-role skill, evidence, how far down the official list the player's set comes (and start
speed when that factor is on). Set position matters because sets are called in list order and, after
the first ten, a player is called only if a franchise asks for him; the list is published about a
week before the auction. The 80% interval is `exp(μ ± 1.2816σ)`.

**Same kind only.** A mini-auction model learns only from earlier mini auctions and a mega-auction
model only from earlier mega auctions, because the two are priced differently (whole squads rebuilt,
far bigger purses, right-to-match cards). For 2026 that is the 2020, 2021, 2023 and 2024 mini
auctions; for the 2024 back-test, 2020, 2021 and 2023. A mega-auction price still counts as a
player's previous price. Two ways of mixing the kinds were tried on the mini back-tests and both did
worse than keeping them apart: a mega indicator alone, and the indicator plus a supply measure (how
many players of the same listed role sat at or above his base price, per open squad place). Marking
whether a previous price came from a mega auction added nothing either.

**Earlier auctions as price history.** The 2018 mega and the 2019, 2020 and 2021 mini auctions were
rebuilt from the archived official records (data/SOURCES.md), so players such as Pat Cummins (₹15.5 Cr
in 2020) carry their earlier IPL price. The 2018 and 2019 lists print no international caps, and 2019
no sets either, so those two auctions only supply prices; 2020 and 2021 are full training auctions.

**Back-tests of the value model alone.** Before any simulation, the value model is scored on every
past auction that has earlier auctions of its kind to learn from: the 2021, 2023 and 2024 mini
auctions and the 2025 mega auction. Scores: censored log-likelihood per player (a sold player scores
the density of his price, an unsold one the chance his price fell short of base), the price error and
rank correlation of the median price given a sale, and the sold/unsold AUC. The ridge penalty is the
one with the best mean log-likelihood over the mini back-tests. Set position was kept because it
improved both kinds: sold/unsold AUC 0.70 → 0.79 on 2024 and 0.80 → 0.87 on 2025. Adding the 2020 and
2021 auctions lifted the 2024 log-likelihood from −0.710 to −0.669 and its AUC from 0.79 to 0.80.

## 4. Needs (`engine/needs.py`)

Template: the average role mix of IPL squads over the last three seasons, scaled to 25. A team's
need for a player is the biggest gap he fills in his main role (full weight) or second role (half):
the depth gap (share of template slots still empty) plus an upgrade gap (how many standard
deviations he improves on the team's best in that role), a keeper gap, and with matchups on, lineup
weaknesses (a batting core that struggles against a bowler type; no left-arm pace).

## 5. Agents (`engine/agents.py`)

Ten copies of the same code. Each lot, a team's **gate** opens only with a role need, a squad slot,
an overseas slot if needed, and a purse that still covers the minimum squad at the lowest base
price. Its **walk-away price** is

    value × need × scarcity × purse pressure × home fit × style × noise

capped at its maximum bid. Need maps the need score to a multiplier; scarcity compares open demand
for the role with comparable players still to come; purse pressure compares the team's money per
open slot with the auction average; home fit (weight 0.5) rewards spinners at spin-friendly grounds,
pacers at pace-friendly ones, and batters whose matchups suit the ground; style is the team's past
over- or under-payment against the value model relative to the average buyer, shrunk. Two random
parts: **market**, one draw per player per run from the value model's own error, shared by every team
(how the whole room rates him that day), and **noise**, each team's own lognormal draw. A team bids
until the price passes its walk-away, then drops out with the reason. Needs update after every sale.

**Team habits: researched, tested, shown as background.** Each franchise's buys in the auctions on
file (2018–2025) were profiled against the league: veterans, young uncapped Indians, overseas, capped,
spin and pace bowlers, all-rounders, keepers, its own former players and top-priced buys (MI buy the
youngest, PBKS spend most on stars and all-rounders, CSK and KKR bring back former players most). A
conditional-logit model of which team buys a sold player, fitted on earlier auctions only, picked the
real buyer no better than chance in the 2023 and 2024 mini auctions (in the top three 25–33% of the
time against 30%), and bringing back former players held only in mega auctions, where right-to-match
cards apply. In a mini auction a team's current gaps and money decide, so the agents do not use the
habits; the app shows them in each team's panel, with cited reporting from before the auction
(docs/TEAMS.md).

## 6. Engine (`engine/auction.py`)

The procedure is researched in `docs/AUCTION.md`. The first 70 names are called set by set, the
order inside each set drawn at random. Then an accelerated round of the players franchises nominate
from the rest of the list (a team nominates a player it would bid for at base). Then further rounds,
repeated while sales still happen: each team with open slots shortlists the best value for money left,
one name per slot, and pays at least base for them, as franchises completing their squads do.

Each lot is **settled from the walk-away prices alone**: the highest walk-away wins and pays one price
point above the runner-up's last affordable bid, or that bid if the winner cannot go one higher. The
bid-by-bid replay is then built from that result, two paddles at a time as in the room: the runner-up
is in from the start and takes on the other bidders one by one, lowest limit first, each backing out
once the next bid passes its limit, and the winner comes in last and outbids him. It always ends in
the settled result, so presentation can never change who wins or the price (`tests/test_engine.py`
checks it). Bids move on fixed price points. Squad and overseas limits and the
purse reserve follow `docs/RULES.md`. Every run writes an event log.

## 7. Monte Carlo (`engine/montecarlo.py`)

1,000 runs; run `r` uses seed `(20251216, year, r)` and replays exactly. Per player: chance sold,
chance for each buyer, median price, 80% range. Per team: spend, purse left, share of pre-auction
depth gap filled.

## 8. Tuning and ablation (`analysis/tune.py`)

On the 2024 auction, with only what was known before it (the value model's ridge penalty comes from
its own back-test in section 3): the agent weights are chosen by a coordinate search (200 runs per point, one coordinate pass,
common random numbers) minimising price error plus a penalty for 80% ranges that miss 80% coverage.

**Team needs are the core.** They decide which teams bid at all, so they are tested directly
against the real buyers, with no simulation in between: in 2024 the real buyer was one of the three
teams with the greatest pre-auction need for the player in 43% of the 72 buys, against 30% by chance
(about 2.5 standard errors). The need gate itself is permissive (open for 84% of teams on the
players who sold), so it is the need score, not the gate, that carries this signal. Stricter gates
(0.3 to 0.8) were tried: buyer accuracy moved by less than the noise and price error got worse.

**Add-ons.** Then a forward ablation with 800 runs per step. Starting from value plus needs, each
add-on (matchups, start speed, home fit) is kept if it improves price error or buyer accuracy by more
than the simulation's own seed-to-seed noise (two standard deviations across six independent blocks
of runs) without making the other worse by more than that. Every step also reports the
paired-bootstrap 95% interval of its difference. With only 72 sales in 2024, no add-on clears the
strict 95% test; the table shows those intervals rather than hiding them. The same model without
needs, and need-only bidders, are reported for comparison.

**Why six blocks, and why needs are not ablated.** With three blocks the noise estimate swung tenfold
between two otherwise identical tunings, and decisions flipped with it. In the simulation, needs
add about 7 points of buyer accuracy against 8 points of noise, while the direct test above is clear;
the agents are built on needs, so they stay, and the table still shows the model without them.

Because the weights and factors were chosen on 2024, those numbers are tuning-set fits; the honest
test is the separate 2026 comparison. Naive baselines (every player at his base price, or at his last
IPL price) are reported alongside.
