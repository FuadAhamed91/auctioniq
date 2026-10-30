# AuctionIQ: short description

**What it is.** AuctionIQ re-runs the IPL 2026 mini-auction (16 Dec 2025, Abu Dhabi) 1,000 times using
only what was known that morning, and replays any lot bid by bid in a 3D auction room. Pick a player and
the app fast-forwards to his lot, shows which franchises wanted him and why, plays the bidding war with
each team's walk-away price, and sets the result against all 1,000 runs.

**How.** Ball-by-ball data from about 5,000 men's T20 matches (Cricsheet) becomes IPL-equivalent skills
per player: runs added per ball against the same phase and venue, adjusted for league strength, weighted
toward recent seasons and shrunk by evidence, with roles from usage and matchups against six bowler
types. A censored regression trained only on earlier auctions of the same kind (mini or mega) turns
skills, caps, age, base price, previous price and the player's place in the official list into a
value with an 80% interval. Ten rule-based franchise agents, each with its real
purse, slots and retained squad, open a bid gate only for players they need and bid up to a walk-away
price they can explain (value × need × scarcity × purse pressure × style × noise). The engine follows the
published auction procedure: sets, random draw inside sets, price-point bid ladder, accelerated rounds,
purse reserve, overseas fee cap.

**How we know it's sound.** Every weight was tuned, and every add-on kept or dropped, on the 2024
auction using only data from before it; earlier official auction records (2018–2021) were researched
so players carry their past IPL prices, and mega and mini auctions are never mixed. Team needs are the
agents' core: the real 2024 buyer was one of the three neediest teams in 43% of buys (30% by chance).
Matchups, start speed and home fit were dropped because they did not beat the simulation's own noise.
On 2024 the model calls sold or unsold right for 85% of players, separates them far better than a
base-price anchor (AUC 0.80 vs 0.64), and puts the real buyer among its three likeliest teams 42% of the
time (35% without team needs). 56% of real prices fall within 25% of its median and 75% inside its 80%
ranges, but record bids for a few stars are badly under-priced. Checked on its own, the value model
reaches AUC 0.80–0.83 on three past mini auctions and 0.87 on the 2025 mega auction.
Every number in the app shows its range and the evidence behind it, and the real 2026 results are read
only by a separate comparison script.

**Why it's useful.** For a franchise it is a rehearsal room: who else needs this player, how high the room
is likely to go, and where the bargains are. For fans and media it explains an auction rather than just
reporting it.

Unofficial; not affiliated with the IPL or the BCCI.
