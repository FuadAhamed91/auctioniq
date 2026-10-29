# IPL 2026 mini-auction: rules as they stood on 16 Dec 2025

Everything below is pre-auction information with a source link. Source keys (S…) point to the
table at the bottom; full details and access dates are in `data/SOURCES.md`. Nothing here uses the
2026 results.

## The event

| | |
|---|---|
| Date, place | Tuesday 16 Dec 2025, Etihad Arena, Abu Dhabi; start 1:00 pm UAE (2:30 pm IST), one day (S1, S5) |
| Format | Mini-auction: no marquee set, opens with capped batters (S4) |
| Slots | 77 in total, of which 31 overseas (S1); per team in `data/auctions/teams_2026.csv` (S3) |
| Purses | ₹237.55 Cr in total (S3); per team in `teams_2026.csv`. Each team's 2026 purse is ₹125 Cr: "Total money spent" + "Salary cap available" = 125.00 Cr for all ten teams in the official squad list (S2) |

## Squads

- Squad size 18 to 25 after the auction; at most 8 overseas players (S4).
- Squads carried into the auction (retentions, releases and trades up to 15 Nov 2025):
  `data/auctions/retained_2026.csv` (S2). Counts and overseas counts match the official auction page (S3).

## Right to Match

- Not available in 2026: "Since it's a mini-auction, the RTM option is not available to the teams" (S4).
  RTM was available at the 2025 mega auction (S6: up to 6 retentions/RTMs per team; 8 RTMs were used,
  see `auction_2025.csv` column `rtm`); per S4 it is not offered at a mini-auction.

## Bid increments

Published ladder (S7 for the 2024 auction, S8 for 2025; both describe it as the BCCI's communication
to the franchises in an earlier auction):

| Current bid | Next bid |
|---|---|
| from the reserve (₹20/30/40/50 L) up to ₹1 Cr | + ₹5 L |
| ₹1 Cr to ₹2 Cr | + ₹10 L |
| ₹2 Cr to ₹5 Cr | + ₹20 L |
| above ₹5 Cr | + ₹25 L |

Bids move on fixed price points of this grid, not relative to the reserve: every 2022, 2023 and
2025 sale above the reserve lands on a multiple of its band step (S9). So a ₹1.25 Cr reserve would
next go to ₹1.30 Cr (implied by the grid; the ₹1.25 Cr reserve only existed in 2025, where no such
player was sold above his reserve but below ₹2 Cr, so the step is not observed directly).

- **2026:** no 2026-specific publication of the ladder was found; the ladder above is the most
  recent published one and is what the brief assumed (+₹5 L to ₹1 Cr, +₹10 L to ₹2 Cr, +₹20 L to
  ₹5 Cr, +₹25 L above). Not confirmed by a 2026 document.
- **2022, 2023, 2025:** every official sale price (iplt20.com, S9) is a multiple of its band step
  in this ladder, i.e. consistent with it.
- **2024 (contradiction, inferred):** official 2024 prices between ₹5 Cr and ₹10 Cr are all multiples
  of ₹20 L but mostly not of ₹25 L (₹5.80 Cr, ₹6.40 Cr, ₹6.80 Cr, ₹7.20 Cr, ₹7.40 Cr, ₹8.40 Cr),
  while every price above ₹10 Cr is a multiple of ₹25 L (₹11.50, 11.75, 20.50, 24.75 Cr). So in 2024
  the ₹20 L step ran up to ₹10 Cr and ₹25 L applied above ₹10 Cr. No source states this; it is inferred
  from the official prices only (S9). A Wisden explainer for 2024 describes a different ladder
  (+₹20 L to ₹1 Cr, +₹25 L to ₹2 Cr, +₹50 L above, S10); the official prices of every year contradict
  it (e.g. 2024 sales at ₹4.20 Cr and ₹6.80 Cr), so it is not used.

## Overseas fee cap (mini-auctions, 2026 and 2027)

- An overseas player's fee at a mini-auction is capped at the lower of the highest retention slab
  (₹18 Cr) and the highest price at the previous mega auction (₹27 Cr): **₹18 Cr** (S4, S11).
- The franchise pays the full winning bid out of its purse; the player receives at most ₹18 Cr and the
  excess goes to the BCCI (player-welfare programmes) (S11). Indian players are not capped (S11).
- The official regulations announcement (S6) lists the 2025-27 rules but does not spell out this
  cap; it is reported by ESPNcricinfo and myKhel from the regulations shared with franchises.

## Players, base prices and sets (official list, S12)

- 350 players announced on 9 Dec 2025 (240 Indian, 110 overseas: 16 capped Indian, 96 capped overseas,
  224 uncapped Indian, 14 uncapped overseas) (S1). The 9 Dec list file had 359 (S13); 19 late
  additions on 15 Dec 2025 made the final pool **369** (S5, S12). `pool_2026.csv` is that final list.
- Reserve prices (₹ lakh) in the final list: 200 (40 players), 150 (10), 125 (5), 100 (17), 75 (45),
  50 (4), 40 (7), 30 (241). In the announced 350: 200:40, 150:9, 125:4, 100:17, 75:42, 50:4, 40:7,
  30:227 (S1; our parse of S12 matches exactly).
- Capped players are listed at ₹75 L–₹2 Cr, uncapped at ₹30–50 L, the one associate at ₹30 L.
  Exception: Kyle Verreynne is listed "Uncapped" at ₹1.25 Cr although the same list gives him
  31 Tests and 19 ODIs (kept as listed; S12 and the auction page S3 agree on "Uncapped").
- **42 sets.** Order: capped BA1, AL1, WK1, FA1, SP1 (sets 1–5), uncapped UBA1, UAL1, UWK1, UFA1,
  USP1 (sets 6–10), then BA2, AL2, WK2, FA2, SP2, UBA2 … UAL10 (sets 11–42) (S4, S12). Set codes:
  BA batter, AL all-rounder, WK wicketkeeper, FA fast bowler, SP spinner, U = uncapped.
- List numbers 1–70 are sets 1–10. The 19 late additions are numbered 351–369 but carry set numbers
  13, 25, 28, 30, 31, 34, 38 and 42, i.e. all of them after list number 70.

## Order of play and accelerated rounds

- The first 70 players (sets 1–10) are presented in set order (S4, S13). In earlier auctions the
  auctioneer drew the names within each set at random (S7, S8). Our `lot_no` / `list_no` follow the
  official list, which is alphabetical by surname within a set, so they give the set order but not
  the order names were drawn inside a set.
- **Accelerated process starts at list number 71** ("after player No. 70") and covers the rest of the
  list; the franchises then submit names of unsold (and unpresented) players from the whole list for
  further accelerated rounds (S4, S13).
- Accelerated start in earlier auctions, for the back-tests:

| Auction | Presented in set order | Accelerated from list no. | Source |
|---|---|---|---|
| 2022 (mega) | 1–161 (sets 1–18) | 162 (players 98–161 on day 2 before lunch) | S14 |
| 2023 (mini) | 1–86 (sets 1–13) | 87 | S15 |
| 2024 (mini) | 1–70 (sets 1–10) | 71 | S7 |
| 2025 (mega) | 1–116 (sets 1–17) | 117 (nominations for 117–577 due 10 pm IST on day 1) | S8 |
| 2026 (mini) | 1–70 (sets 1–10) | 71 | S4, S13 |

The set boundaries in the middle column are taken from the official lists and agree with each source.

## Other regulations in force (2025-27 cycle, S6)

- Match fee ₹7.5 L per match per playing member, on top of the contract.
- A player who registers, is picked and then makes himself unavailable before the season is banned
  from the tournament and the auction for 2 seasons.
- A capped Indian player becomes uncapped if he has not played international cricket (starting XI) in
  the last five calendar years and holds no BCCI central contract.
- An overseas player had to register for the 2025 mega auction to be eligible for the 2026 auction.

## Things that contradict the brief or the obvious assumptions

1. Final pool is 369, not 350 (19 late additions on 15 Dec 2025, S5).
2. The 2024 increment ladder differs from the published one between ₹5 Cr and ₹10 Cr (inferred, see
   above); no 2026-specific ladder was published.
3. Two players' nationality changed between list versions: Miles Hammond (India → England) and
   Nikhil Chaudhary (India → Australia) in the corrected list (S12); the iplt20.com auction page still
   shows neither as overseas (S3). `pool_2026.csv` follows the corrected official list (overseas = 1).
4. Kyle Verreynne listed "Uncapped" despite international caps; Virandeep Singh (Malaysia) is
   "Associate" in the list but "Uncapped" on the auction page.
5. The 2026 purse is ₹125 Cr per team (S2), not the ₹120 Cr of 2025.

## Sources

| Key | Source |
|---|---|
| S1 | IPL media advisory, 9 Dec 2025, "TATA IPL 2026 Player Auction List Announced": https://www.iplt20.com/news/article/tata-ipl-2026-player-auction-list-announced |
| S2 | BCCI "TATA IPL 2026 - Playing Squad - 15.11.2025" PDF (Wayback 2025-11-15): https://web.archive.org/web/20251115183118/https://documents.iplt20.com/bcci/documents/1763209725967_TATA%20IPL%202026%20-%20Playing%20Squad%20-%2015.11.2025%20(1).pdf |
| S3 | iplt20.com auction page, pre-auction capture 2025-12-15 and final capture 2026-02-06: https://web.archive.org/web/20251215113714/https://www.iplt20.com/auction/2026 |
| S4 | ESPNcricinfo, "FAQs - The when, where, who and how much of the IPL 2026 auction", 13 Dec 2025: https://www.espncricinfo.com/ci/content/story/1515453.html |
| S5 | IANS, 15 Dec 2025, "Abhimanyu Easwaran, Ben Sears, Ethan Bosch among late additions to auction list": https://ianslive.in/ipl-2026-abhimanyu-easwaran-ben-sears-ethan-bosch-among-late-additions-to-auction-list--20251215224429 |
| S6 | IPL media advisory, 28 Sep 2024, "IPL Governing Council announces TATA IPL Player Regulations 2025-27": https://www.iplt20.com/news/article/ipl-governing-council-announces-tata-ipl-player-regulations-2025-27 |
| S7 | myKhel, 18 Dec 2023, "IPL Auction 2024 Rules: What Is Accelerated Process & How Do Incremental Bids Work?": https://www.mykhel.com/cricket/ipl-auction-2024-rules-accelerated-process-incremental-bids-sets-252271.html |
| S8 | myKhel, 24 Nov 2024, "IPL Mega Auction 2025 Rules: What is Accelerated Process & How do Incremental Bids Work?": https://www.mykhel.com/cricket/ipl-mega-auction-2025-rules-what-is-accelerated-process-how-do-incremental-bids-work-322209.html |
| S9 | iplt20.com auction pages 2022–2025 (Wayback captures listed in `data/SOURCES.md`); prices in `data/auctions/auction_20xx.csv` |
| S10 | Wisden, "IPL auction 2024: All you need to know": https://www.wisden.com/series/tata-indian-premier-league-2023-24/cricket-news/ipl-auction-2024-all-you-need-to-know-format-rules-players-list-sets-team-previews-telecast-details |
| S11 | myKhel, 4 Dec 2025, "IPL 2026 Auction: Why overseas players can receive a maximum of Rs 18 crore in Mini Auction?": https://www.mykhel.com/cricket/ipl-2026-auction-why-overseas-players-can-receive-a-maximum-of-rs-18-crore-in-mini-auction-400131.html |
| S12 | BCCI "TATA IPL 2026 - Auction List" PDF, final version with 369 players (Wayback 2026-01-04): https://web.archive.org/web/20260104113422/https://documents.iplt20.com/bcci/documents/1765197869375_TATA-IPL-2026-Auction-List-8.12.25.pdf |
| S13 | ESPNcricinfo, 9 Dec 2025, "IPL 2026 auction - De Kock added in 359-player shortlist, Green part of first set": https://www.espncricinfo.com/ci/content/story/1514989.html |
| S14 | Onmanorama, 11 Feb 2022, "IPL 2022 auction details at a glance" (players 98–161 on day 2, then accelerated): https://onmanorama.com/sports/cricket/2022/02/11/ipl-2022-auction-details-at-a-glance.html ; set 18 ends at list no. 161 in the official 2022 list |
| S15 | CricTracker, 23 Dec 2022, "IPL 2023: What is the accelerated process in Player Auction?": https://www.crictracker.com/cricket-news/ipl-2023-what-is-the-accelerated-process-in-player-auction/ |
