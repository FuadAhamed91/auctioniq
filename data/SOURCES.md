# Data sources and validation

All sources were accessed on **2026-10-29**. Money is in integer lakhs (₹1 Cr = 100 L).

The live iplt20.com auction pages now return 404 and the BCCI documents server returns 403 for the
older files, so the official pages and PDFs were read from their Internet Archive (Wayback Machine)
captures; the capture timestamp is part of each link. PDFs were converted with `pdftotext -table`
(Xpdf 4.00) and parsed by column position, with every row cross-checked against `pdftotext -raw`.

## Sources

### Official auction lists (BCCI / IPL PDFs)

| Auction | File (capture) | Gave |
|---|---|---|
| 2022 | [IPL2022PlayerAuction_List_Sets.pdf](https://web.archive.org/web/20241102102010/https://documents.iplt20.com/documents/IPL/document/2022/02/IPL2022PlayerAuction_List_Sets.pdf), list of 01.02.2022 (590 players) | same fields as 2023 (`auction_2022.csv`); set boundaries in RULES.md |
| 2023 | [TATA IPL 2023 Player Auction List.pdf](https://web.archive.org/web/20221213233047/https://documents.bcci.tv/bcci/documents/1670855906324_TATA%20IPL%202023%20Player%20Auction%20List.pdf), list of 12.12.2022 (405) | list no., set no./code, name, country, C/U/A, role, base, DOB, age, bat/bowl style, Test/ODI/T20I/IPL caps |
| 2024 | [IPL 2024 Auction List- 11.12.23.pdf](https://web.archive.org/web/20250503045038/https://documents.iplt20.com/bcci/documents/1702300206581_IPL%202024%20Auction%20List-%2011.12.23.pdf) (333) | same fields |
| 2025 | [TATA IPL 2025- Auction List with RTM -19.11.24.pdf](https://web.archive.org/web/20241122082227/https://documents.iplt20.com/bcci/documents/1732248356511_TATA%20IPL%202025-%20Auction%20List%20with%20RTM%20-19.11.24.pdf) (577 = 574 of [15.11.24](https://web.archive.org/web/20241115135058/https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf) + 3 additions) | same fields (+ RTM franchise, not used) |
| 2026 | [TATA-IPL-2026-Auction-List-8.12.25.pdf, final version](https://web.archive.org/web/20260104113422/https://documents.iplt20.com/bcci/documents/1765197869375_TATA-IPL-2026-Auction-List-8.12.25.pdf) (369; header "9.12.25") | `pool_2026.csv` (all columns) |
| 2026 | same URL, [capture of 2025-12-10](https://web.archive.org/web/20251210105833/https://documents.iplt20.com/bcci/documents/1765197869375_TATA-IPL-2026-Auction-List-8.12.25.pdf) (350) and [9.12.25 file](https://web.archive.org/web/20251218004943/https://documents.iplt20.com/bcci/documents/1765284319912_TATA%20IPL%202026%20-%20Auction%20List%20-%209.12.25.pdf) (359) | earlier versions, used to document changes |

### Official auction pages (iplt20.com /auction/{year})

Pre-auction captures ("To be Auctioned" tab + team purse/squad table) and post-auction captures
(sold players per team with price, unsold players with base price, team funds remaining):

| Auction | Pre-auction capture | Post-auction capture |
|---|---|---|
| 2022 | [2022-02-12 05:10 UTC](https://web.archive.org/web/20220212051052/https://www.iplt20.com/auction/2022) (600 players, purses) | [2022-03-09](https://web.archive.org/web/20220309101400/https://www.iplt20.com/auction/2022) |
| 2023 | [2022-12-23 08:49 UTC, auction morning](https://web.archive.org/web/20221223084939/https://www.iplt20.com/auction) (405, purses) | [2023-01-30](https://web.archive.org/web/20230130144739/https://www.iplt20.com/auction/2023) |
| 2024 | [2023-12-18](https://web.archive.org/web/20231218120732/https://www.iplt20.com/auction/2024) (333, purses); [during auction 2023-12-19](https://web.archive.org/web/20231219132538/https://www.iplt20.com/auction/2024) (pool of 332) | [2024-02-15](https://web.archive.org/web/20240215104558/https://www.iplt20.com/auction/2024) |
| 2025 | [2024-11-24 00:10 UTC](https://web.archive.org/web/20241124001026/https://www.iplt20.com/auction/2025) (577, purses) | [2025-01-20](https://web.archive.org/web/20250120183819/https://www.iplt20.com/auction/2025) (incl. RTM icons) |
| 2026 | [2025-12-15](https://web.archive.org/web/20251215113714/https://www.iplt20.com/auction/2026) (350, purses) | [2026-02-06](https://web.archive.org/web/20260206224855/https://www.iplt20.com/auction/2026) |

Later captures (2022-08-22, 2023-05-29, 2024-06-19, 2025-07-19, 2026-03-17) give identical sold and
unsold tables.

### Retentions, squads, announcements

| Source | Gave |
|---|---|
| IPL media advisory 26 Nov 2023, [IPL 2024 Player retentions list](https://web.archive.org/web/20231202034818/https://www.iplt20.com/news/3981/ipl-2024-player-retentions-list) | `retained_2024.csv` names per team; per-team squad/overseas/purse table |
| [Hardik Pandya and Cameron Green traded to MI and RCB](https://web.archive.org/web/20231127133428/https://www.iplt20.com/news/3982/hardik-pandya-and-cameron-green-traded-to-mi-and-rcb) (27 Nov 2023) | the two moves applied after the retention list |
| IPL media advisory 11 Dec 2023, [IPL 2024 Player Auction list announced](https://web.archive.org/web/20231212123859/https://www.iplt20.com/news/3983/ipl-2024-player-auction-list-announced) | 333 players, 77 slots / 30 overseas, per-team table after the trades (= `teams_2024.csv`) |
| iplt20.com team pages, Dec 2023 captures: [CSK](https://web.archive.org/web/20231217103030/https://www.iplt20.com/teams/chennai-super-kings/), [DC](https://web.archive.org/web/20231202144528/https://www.iplt20.com/teams/delhi-capitals/squad), [GT](https://web.archive.org/web/20231211153823/https://www.iplt20.com/teams/gujarat-titans/squad), [KKR](https://web.archive.org/web/20231215193340/https://www.iplt20.com/teams/kolkata-knight-riders), [LSG](https://web.archive.org/web/20231202152926/https://www.iplt20.com/teams/lucknow-super-giants/squad), [MI](https://web.archive.org/web/20231216031843/https://www.iplt20.com/teams/mumbai-indians), [PBKS](https://web.archive.org/web/20231211163344/https://www.iplt20.com/teams/punjab-kings/squad), [SRH](https://web.archive.org/web/20231205140634/https://www.iplt20.com/teams/sunrisers-hyderabad) | overseas icon per retained player (RR and RCB pages not captured) |
| BCCI [TATA IPL 2026 - Playing Squad - 15.11.2025](https://web.archive.org/web/20251115183118/https://documents.iplt20.com/bcci/documents/1763209725967_TATA%20IPL%202026%20-%20Playing%20Squad%20-%2015.11.2025%20(1).pdf) | `retained_2026.csv` (names, `*` = overseas, traded flags), per-team counts and purses |
| BCCI [IPL 2025 Retained Players](https://web.archive.org/web/20241106054536/https://documents.iplt20.com/smart-images/1730381551643_IPL-2025-Retained-Players.pdf) | 2025 purses / retained counts (cross-check of `markets.csv`) |
| IPL media advisory 1 Feb 2022, [IPL 2022 Player Auction list announced](https://web.archive.org/web/20231209071554/https://www.iplt20.com/news/3721/ipl-2022-player-auction-list-announced) | 2022: 590 players, Bengaluru 12–13 Feb, per-team salary cap left and slots |
| IPL media advisory 13 Dec 2022, [TATA IPL 2023 Player Auction list announced](https://web.archive.org/web/20221214011229/https://www.iplt20.com/news/3852/tata-ipl-2023-player-auction-list-announced) | 2023: 405 players (273 Indian, 132 overseas), 87 slots / 30 overseas, Kochi 23 Dec 2022, per-team purse/slot table, link to the PDF |
| myKhel, 24 Nov 2024, [IPL Mega Auction 2025 rules](https://www.mykhel.com/cricket/ipl-mega-auction-2025-rules-what-is-accelerated-process-how-do-incremental-bids-work-322209.html) | 2025 auction dates (24–25 Nov 2024), 577 players, 204 slots / 70 overseas |
| IPL media advisory 9 Dec 2025, [TATA IPL 2026 Player Auction List Announced](https://www.iplt20.com/news/article/tata-ipl-2026-player-auction-list-announced) (live page) | 350 players, capped/uncapped and reserve-price breakdown, 77 slots / 31 overseas, Abu Dhabi 16 Dec |
| IANS, 15 Dec 2025, [late additions](https://ianslive.in/ipl-2026-abhimanyu-easwaran-ben-sears-ethan-bosch-among-late-additions-to-auction-list--20251215224429) | 19 players added on 15 Dec, pool 369 |
| ESPNcricinfo [2023 IPL auction: the list of sold and unsold players](https://www.espncricinfo.com/ci/content/story/1350272.html) (23 Dec 2022) | cross-check: Shivam Singh sold to PBKS at base ₹20 L; Rehan Ahmed's base ₹50 L |
| Lokmat Times, [Ben McDermott withdraws from IPL 2023 auction](https://www.lokmattimes.com/cricket/news/ben-mcdermott-withdraws-from-ipl-2023-auction-a475) | McDermott withdrew on auction morning |
| myKhel, [IPL 2024 auction: Shoriful, Taskin withdraw their names, two Indians added](https://www.mykhel.com/cricket/ipl-2024-auction-shoriful-taskin-withdraw-their-names-two-indians-added-252415.html) and [Outlook](https://www.outlookindia.com/sports/ipl-2024-josh-hazlewood-available-only-in-may-taskin-ahmed-shoriful-islam-withdraw-from-auction-news-337287) | 2024: Rehan Ahmed withdrew; Taskin Ahmed and Shoriful Islam made unavailable by the BCB; two Indians (Sahil Dhiwan, Kaushal Tambe) added |
| Wikipedia infoboxes: [Rehan Ahmed](https://en.wikipedia.org/wiki/Rehan_Ahmed), [Nandre Burger](https://en.wikipedia.org/wiki/Nandre_Burger) | international debuts (17 Dec 2022 Test; 14 Dec 2023 T20I) explaining their capped status on auction day |
| Rules sources S1–S15 | see `docs/RULES.md` |
| Cricsheet register (`data/raw/register/people.csv`, `names.csv`), cricketdata `player_meta.csv`, Cricsheet IPL scorecards (`data/raw/cricsheet/ipl.zip`) | name mapping (`pipeline/register.py`) |

## What each file is built from

- **auction_2023/2024/2025.csv** – one row per player in the final pool on auction day (sold and
  unsold): status, team, price and RTM from the post-auction page; base price as on auction day (page);
  everything else from the official list PDF. `lot_no` = 1..N in official list order, late additions
  appended at the end; `list_no` = the serial number printed on the PDF (blank for late additions);
  `dob` (ISO), `age` (as printed, computed by the BCCI at list time), `batting_style`,
  `bowling_style` (blank where the list prints "-"), `test_caps`, `odi_caps`, `t20i_caps`,
  `ipl_caps` exactly as printed (blank where the list is blank; the four caps columns exist in all
  three lists). `role` maps the list's BATSMAN to BATTER. `capped` is the list's C/U/A in lower case.
- **auction_2022.csv** – same columns and rules as 2023–2025: the 600-player auction-day pool (590
  from the 01.02.2022 list, then the 10 added after it, in the order of the pre-auction page), sold
  and unsold. The 10 additions went unsold and carry only what the page shows (name, overseas, role,
  base price). 204 sold, ₹551.70 Cr, 67 overseas, as on the post-auction page.
- **pool_2026.csv** – the final 369-player list (S12 in RULES.md), in list order; `team_2025` and
  `ipl_2025_matches` are the list's "2025 Team" / "2025 IPL" columns (the 2026 list has no
  "previous teams" column); `ipl_caps` is the list's "IPL" column.
- **results_2026.csv** (data/actual_2026 only) – post-auction 2026 page joined to the pool; names
  spelled as in `pool_2026.csv`; `unsold` includes players never called.
- **teams_2024.csv / teams_2026.csv** – pre-auction team table of the auction page:
  `slots = 25 − squad_size`, `overseas_slots = 8 − overseas_count`.
- **retained_2024.csv** – retention release + the two 27 Nov trades; overseas flag from the team
  pages, else the country printed in an official 2022–2025 auction list, else the 2026 squad PDF,
  else player_meta country (all sources agree wherever more than one applies; the per-row evidence
  is not stored). Per-team counts and overseas counts equal the official table.
- **retained_2026.csv** – the 15.11.2025 squad PDF; counts and overseas counts per team equal the
  official table and the pre-auction page.
- **markets.csv** – sum of the ten pre-auction purses, slots and overseas slots from the pre-auction
  page of each year. Team by team these equal the official tables: the 2022, 2023 and 2024 list
  announcements, the 2025 retained-players PDF and the 2026 squad PDF (totals ₹561.50 / 206.50 /
  262.95 / 641.50 / 237.55 Cr; 217 / 87 / 77 / 204 / 77 slots; 70 / 30 / 30 / 70 / 31 overseas).
  `players_in_list` is the auction-day pool (2022: 590 + 10 added; 2023: 405 − 1 withdrawn + 1 added;
  2024: 333 − 3 withdrawn + 2 added; 2025: 574 + 3; 2026: 350 + 19); `date` is the first day (2022
  and 2025 ran over two days); `city` from the same announcements (2025: Jeddah, per IANS).

## Validation

Official figures are the summary counters of the iplt20.com post-auction pages.

| Auction | Rows in file | Sold (ours / official) | Overseas sold (ours / official) | Spend ₹ Cr (ours / official) |
|---|---|---|---|---|
| 2022 mega | 204 sold rows (pool 600) | 204 / 204 | 67 / 67 | 551.70 / 551.70 |
| 2023 mini | 405 | 80 / 80 | 29 / 29 | 167.00 / 167.00 |
| 2024 mini | 332 | 72 / 72 | 30 / 30 | 230.45 / 230.45 |
| 2025 mega | 577 | 182 / 182 (RTM 8 / 8) | 62 / 62 | 639.15 / 639.15 |

Per-team spend (₹ Cr). For every team and year our sum equals the official pre-auction purse minus
the official post-auction "funds remaining", and the pre-auction squad + players bought equals the
post-auction squad (also for overseas players):

| Auction | CSK | DC | GT | KKR | LSG | MI | PBKS | RR | RCB | SRH |
|---|---|---|---|---|---|---|---|---|---|---|
| 2022 | 45.05 | 47.40 | 51.85 | 47.55 | 59.00 | 47.90 | 68.55 | 61.05 | 55.45 | 67.90 |
| 2023 | 18.95 | 15.00 | 14.80 | 5.40 | 19.80 | 20.50 | 20.00 | 9.85 | 7.00 | 35.70 |
| 2024 | 30.40 | 19.05 | 30.30 | 31.35 | 12.20 | 16.70 | 24.95 | 14.30 | 20.40 | 30.80 |
| 2025 | 54.95 | 72.80 | 68.85 | 50.95 | 68.90 | 44.80 | 110.15 | 40.70 | 82.25 | 44.80 |

`results_2026.csv` passes the same checks against the official 2026 page (sold count, overseas sold,
total spend and all ten teams' remaining purses); the figures are deliberately not repeated here.

Other checks: list composition equals each announcement (2023: 273 Indian / 132 overseas, 119 capped /
282 uncapped / 4 associate, 19 at ₹2 Cr, 11 at ₹1.5 Cr, 20 at ₹1 Cr; 2024: 214 / 119, 116 / 215 / 2;
2026 announced 350: 16 / 96 / 224 / 14 and the reserve-price table exactly); `teams_2026.csv` equals
the brief (₹237.55 Cr, 77 slots, 31 overseas) team by team.

## Changes between list and auction day, conflicts and decisions

- **2023:** Ben McDermott (list no. 91) withdrew on auction morning: not in the file. Shivam Singh
  is on the auction-day pool and was sold to PBKS at ₹20 L but is not in the 12.12.2022 PDF: no
  list number/set; DOB, styles and `uncapped` from his row in the 2025 list (no. 207, prev. team PBKS).
  Rehan Ahmed: PDF base ₹40 L uncapped, auction-day base ₹50 L (page and ESPNcricinfo); he made his
  Test debut on 17 Dec 2022, so `capped` is set to capped. "Abdul PA" in the table text is "Abdul P A"
  in the raw text and on the pages (spaced form used).
- **2024:** Rehan Ahmed withdrew, Taskin Ahmed and Shoriful Islam unavailable (BCB): not in the file.
  Sahil Dhiwan and Kaushal Tambe added: no list number/set; DOB and styles from their rows in the 2023
  and 2022 lists. Nandre Burger: PDF base ₹20 L uncapped, auction-day base ₹50 L; T20I debut 14 Dec
  2023, so capped. Two players named Shashank Singh: the one sold to PBKS is list no. 237
  (Chhattisgarh, born 21/11/1991; he is PBKS's Shashank Singh in the 2024 Cricsheet scorecards) – the
  iplt20 page's role labels for the two are swapped.
- **2025:** 3 late additions (Jofra Archer, Saurabh Netravalkar, Hardik Tamore). Four associate
  players (Unmukt Chand, Ali Khan, Brandon McMullen, Saurabh Netravalkar) are "Associate" in the list
  and "Uncapped" on the page; the list is kept. Hardik Tamore's printed age (33) does not fit his DOB
  (1997); both kept as printed. Akash Singh sold to LSG is list no. 220 (born 26/04/2002), not no. 341.
- **2026:** 19 late additions (lot 351–369) on 15 Dec. The final list corrects Miles Hammond to
  England and Nikhil Chaudhary to Australia (India in the 8.12.25 version); the auction page shows
  neither as overseas; the corrected list is used (overseas = 1). Kyle Verreynne "Uncapped" at ₹1.25 Cr
  and Virandeep Singh "Associate" (page: Uncapped) are kept as listed. Lot 360 (Abhimanyu Easwaran) is
  printed with set no. 31 but set code UBA4 (the code of set 30); kept as printed. Base prices on the
  page and in the list agree for all 369.
- **2022:** Deepak Hooda: list ₹40 L uncapped, auction-day base ₹75 L (used in `base_lakh`).
- **Retained 2024:** the Dec 2023 DC team page marks Abhishek Porel as overseas; he is Indian (official
  overseas count 4 for DC; unmarked in the 2026 squad PDF) – the flag is 0.
- **Retained 2026:** the PDF's per-team "Total money spent" differs from the sum of the listed
  deductions for CSK, DC, KKR and RR (retention-slab accounting), so salaries are not included.

## Gaps

- No set number / list number for the three players added after the PDFs (2023 Shivam Singh; 2024
  Sahil Dhiwan, Kaushal Tambe): left blank. Their `age` is blank too (DOB given).
- Whether an unsold player was actually called is not recorded (`unsold` includes players never
  presented); only partial evidence exists (ESPNcricinfo's 2023 list, mid-auction captures).
- No 2026-specific publication of the bid-increment ladder (see RULES.md).
- Ages are as printed by the BCCI and occasionally inconsistent with the DOB; prefer `dob`.

## Name mapping (`pipeline/register.py`)

`python -m pipeline.register` rebuilds `name_map.csv` (1066 keys, 808 matched) and `unmatched.csv`
(258 keys). Every capped and associate player in every file is matched; the unmatched are uncapped
players (and six 2022 buys) with no Cricsheet record or none that can be tied to them safely.

| File | Rows matched | Unmatched | Notes |
|---|---|---|---|
| auction_2022 (sold) | 198 / 204 | 6 | |
| auction_2023 | 356 / 405 | 49 | sold 79/80, uncapped 233/282 |
| auction_2024 | 275 / 332 | 57 | sold 67/72, uncapped 159/216 |
| auction_2025 | 471 / 577 | 106 | sold 174/182, uncapped 225/331 |
| pool_2026 | 249 / 369 | 120 | uncapped 132/252 |
| retained_2024 | 172 / 173 | 1 | Vicky Ostwal (no Cricsheet record) |
| retained_2026 | 171 / 173 | 2 | Harnoor Pannu, Pyla Avinash (no Cricsheet record) |

Methods: 752 by date of birth + compatible name, 43 by IPL squad sheet, 5 by near DOB, 2 by DOB +
same first name, 6 hand overrides (`name_overrides.csv`, each with evidence: Digvesh Singh = DS Rathi,
and five players whose BCCI and Cricinfo birthdays differ). Same-name different people (Akash Singh,
Shashank Singh, Lalit Yadav, Prince Yadav, Shivam Sharma, Himanshu Singh, Ankit Kumar) are keyed as
`name|dob` (or `name|retained_YYYY|TEAM`); use `register.lookup()`.
