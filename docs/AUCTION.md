# How an IPL auction runs, and how AuctionIQ plays it

The engine follows the published procedure step by step. Where the published rules and the
official sale prices disagree, it follows the prices, and says so.

| Step on the day | What the rules say | What the engine does |
|---|---|---|
| **The list** | Franchises shortlist registered players; the final list is published before the day with each player's set and base price. 2026: 369 names in 42 sets (359 at first, plus late additions slotted into their sets). | `data/auctions/pool_2026.csv` is that list, in official order with set codes and base prices. Nothing from the day itself is used. |
| **Set order** | No marquee set in a mini-auction. A full round of capped players (batters, all-rounders, wicketkeepers, fast bowlers, spinners), then a full round of uncapped players in the same order [1][2]. | Sets are called in list order (BA1, AL1, WK1, FA1, SP1, UBA1 …). |
| **Order inside a set** | The auctioneer calls the first 70 names set by set, "but the player name will be drawn randomly" [4]. | Every run draws the order inside each set at random (seeded, so a run replays exactly). |
| **A lot** | The auctioneer names the player and opens at his base price; franchises raise a paddle to bid; a team cannot bid against itself; with no paddle at base the player is unsold. | Teams whose bid gate opens can bid; each bids until the price passes its walk-away; the last team standing buys. No paddle at base → unsold. |
| **Bid increments** | Published: +₹5 L up to ₹1 Cr, +₹10 L to ₹2 Cr, +₹20 L to ₹5 Cr, +₹25 L above [4][5]. | Bids move on these price points (multiples of the band's step), which every 2022, 2023 and 2025 sale price fits. In 2024 every price between ₹5 Cr and ₹10 Cr is a multiple of ₹20 L (Head went for ₹6.80 Cr), so the 2024 back-test uses ₹20 L steps up to ₹10 Cr. `tests/test_data.py` checks every real price against its ladder. |
| **Late entries** | Franchises often wait and join a bidding war late. | Each team enters at a random point below its walk-away. This changes the replay, not who wins or the price. |
| **Accelerated round** | After player No. 70 (the first ten sets in 2024 and 2026) there is a break; each franchise submits the names it wants from the rest of the list; only those names are called, quickly [1][2][4]. | After lot 70, each team nominates the players it would bid for at base; only nominated players are called. |
| **Further rounds** | Franchises still filling squads submit names from the unsold list; "the process will keep on repeating until all ten franchises have completed their squads" [6]. | Further rounds repeat while sales happen: each team with open slots shortlists the best value for money left, one name per slot, and pays at least base for them. |
| **Squad limits** | 18 to 25 players, at most 8 overseas [1]. | Gate checks a squad slot and an overseas slot. |
| **Purse** | A bid must leave enough to complete the minimum squad. | Max bid = purse − ₹30 L for every minimum slot still open after this player (₹20 L in 2024, when the lowest base was ₹20 L). |
| **Overseas fee cap** | In a mini-auction an overseas player keeps at most the lower of the top retention slab (₹18 Cr) and the top mega-auction price; the team pays the full bid and the rest goes to the BCCI [1][3]. | The team pays the full bid; the app shows the player's take-home and the BCCI's share. |
| **Right to Match** | Not available in a mini-auction [1]. | Not modelled. |
| **Silent tie-breaker** | Used only when franchises run out of purse at the same bid. | Not modelled; it needs two teams to bid their whole remaining purse at the same price. |

**What the engine does not do.** Franchises in a real room sometimes bid to push a rival's price up,
change plans mid-auction, or react to the room. AuctionIQ's agents are rule-based on purpose: they
bid only for players they need, up to a price they can explain.

## Sources

1. ESPNcricinfo, "IPL auction 2026 FAQs: where, how much": https://africa.espn.com/cricket/story/_/id/47290249/ipl-auction-2026-faqs-where-how-much
2. ESPNcricinfo, "IPL 2026 auction: 350-player shortlist, Cameron Green part of first set": https://africa.espn.com/cricket/story/_/id/47252857/ipl-2026-auction-quinton-de-kock-350-player-shortlist-cameron-green-part-first-set
3. Outlook India, "IPL 2026 Auction: Why overseas players can't earn more than INR 18 crore": https://www.outlookindia.com/sports/cricket/indian-premier-league-2026-auction-overseas-player-salary-cap-explained-18-crore
4. MyKhel, "IPL Auction 2024 rules: accelerated process, incremental bids, sets": https://www.mykhel.com/cricket/ipl-auction-2024-rules-accelerated-process-incremental-bids-sets-252271.html
5. MyKhel, "IPL mega auction 2025 rules: accelerated process, incremental bids": https://www.mykhel.com/cricket/ipl-mega-auction-2025-rules-what-is-accelerated-process-how-do-incremental-bids-work-322209.html
6. CricTracker, "Explained: the rules for the accelerated round in the IPL 2024 auction": https://www.crictracker.com/cricket-news/explained-what-are-the-rules-for-accelerated-round-in-ipl-2024-auction/
