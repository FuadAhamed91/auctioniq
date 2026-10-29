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
keeper, main-role skill, evidence (and start speed when that factor is on). The ridge penalty is
chosen by the model's own 2024 price error. The 80% interval is `exp(μ ± 1.2816σ)`. Fitted only on
earlier auctions: the 2023 auction for the 2024 back-test; 2023–2025 for 2026.

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

## 6. Engine (`engine/auction.py`)

The procedure is researched in `docs/AUCTION.md`. The first 70 names are called set by set, the
order inside each set drawn at random. Then an accelerated round of the players franchises nominate
from the rest of the list (a team nominates a player it would bid for at base). Then further rounds,
repeated while sales still happen: each team with open slots shortlists the best value for money left,
one name per slot, and pays at least base for them, as franchises completing their squads do.

Each lot is **settled from the walk-away prices alone**: the highest walk-away wins and pays one price
point above the runner-up's last affordable bid, or that bid if the winner cannot go one higher. The
bid-by-bid replay (late entries, duels between two teams) is then drawn from a separate random stream
and always ends in that result, so presentation can never change who wins or the price
(`tests/test_engine.py` checks it). Bids move on fixed price points. Squad and overseas limits and the
purse reserve follow `docs/RULES.md`. Every run writes an event log.

## 7. Monte Carlo (`engine/montecarlo.py`)

1,000 runs; run `r` uses seed `(20251216, year, r)` and replays exactly. Per player: chance sold,
chance for each buyer, median price, 80% range. Per team: spend, purse left, share of pre-auction
depth gap filled.

## 8. Tuning and ablation (`analysis/tune.py`)

On the 2024 auction, with only what was known before it: the value model's ridge penalty is chosen by
its own price error; the agent weights by a coordinate search (200 runs per point, one coordinate pass,
common random numbers) minimising price error plus a penalty for 80% ranges that miss 80% coverage.

Then a forward ablation with 800 runs per step. Starting from value only, each factor (needs, matchups,
start speed, home fit) is kept if it improves price error or buyer accuracy by more than the
simulation's own seed-to-seed noise (two standard deviations across three independent blocks of runs)
without making the other worse by more than that. Every step also reports the paired-bootstrap 95%
interval of its difference. With only 72 sales in 2024, no factor clears the strict 95% test, needs
included; the table shows those intervals rather than hiding them.

Because the weights and factors were chosen on 2024, those numbers are tuning-set fits; the honest
test is the separate 2026 comparison. Naive baselines (every player at his base price, or at his last
IPL price) are reported alongside.
