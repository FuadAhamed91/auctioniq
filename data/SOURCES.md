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
- **auction_2018/2019/2020/2021.csv and the 2018–2021 rows of markets.csv** – same columns and rules
  as 2023–2025, from the official lists (2018, 2019: iplt20.com list tables; 2020, 2021: BCCI PDFs),
  the iplt20.com auction data feeds (2019–2021) and auction pages, and the official purse / slot
  advisories; 2018 RTM buys from ESPNcricinfo. Lists that print no date of birth or styles (2018,
  2019) borrow them from the player's row in a later official list. Details, links and decisions:
  section "Auctions 2018–2021" at the end of this file.

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

## Auctions 2018–2021 (auction_2018 … auction_2021.csv)

Accessed 2026-10-30, every page and file through its Wayback capture (timestamp in the link; all
captures and all events predate the 16 Dec 2025 cutoff). Build scripts: `.cache/scripts/parse1821.py`,
`join1821.py`, `xref1821.py`, `profile1821.py`, `espn2018.py` (all four ESPNcricinfo lists),
`build1821.py` and `validate1821.py`; parsed sources and the manual pairings with their evidence are in
`.cache/parsed1821/` (`manual_join.csv`).

| Auction | Kind, date, city | Purse / slots / overseas slots | Pool on auction day |
|---|---|---|---|
| 2018 | mega, 27–28 Jan 2018, Bengaluru | ₹443 Cr / 182 / 58 | 581 = 578 listed + 3 added |
| 2019 | mini, 18 Dec 2018, Jaipur | ₹145.25 Cr / 70 / 20 | 352 = 351 listed + 1 added |
| 2020 | mini, 19 Dec 2019, Kolkata | ₹207.65 Cr / 73 / 29 | 338 = 332 listed + 6 added |
| 2021 | mini, 18 Feb 2021, Chennai | ₹196.60 Cr / 61 / 22 | 298 = 292 listed − 1 withdrawn + 7 added |

### Sources

Official auction lists:

| Auction | List (capture) | Gave |
|---|---|---|
| 2018 | iplt20.com news 113978 [VIVO IPL 2018 Player Auction list announced](https://web.archive.org/web/20180122075407/http://www.iplt20.com/news/113978/vivo-ipl-2018-player-auction-list-announced) (20 Jan 2018), an HTML table of 578; the BCCI advisory ([bcci.tv 17044](https://web.archive.org/web/20180122013626/http://www.bcci.tv:80/news/2018/news/17044/vivo-ipl-2018-player-auction-list-announced)) gives this table as "the complete list" | list no., set no., set code, first name, surname, country, specialism, IPL caps, C/U/A, reserve. No DOB, age, styles, state or Test/ODI/T20I caps |
| 2019 | iplt20.com news 149676 [Complete list of VIVO IPL 2019 Player Auction](https://web.archive.org/web/20190416122735/https://www.iplt20.com/news/149676/vivo-ipl-2019-player-auction-list-announced) (11 Dec 2018; earliest capture 16 Apr 2019), an HTML table of 351 | first name, surname, country, state association, specialism, reserve, C/U/A. No serial / list number, set, DOB, styles or caps |
| 2020 | BCCI PDF [VIVO IPL 2020 Player Auction List & Sets - 11-12-2019.pdf](https://web.archive.org/web/20191228090148/http://relaunch-live.s3.amazonaws.com/cms/documents/5df0f069f0f2b-VIVO%20IPL%202020%20Player%20Auction%20List%20&%20Sets%20-%2011-12-2019.pdf) (332), linked from news 200294 | the fields of the 2022–2025 lists (+ "2019 Team", "2019 IPL"); a few DOBs with two-digit years, resolved by the printed age |
| 2021 | [VIVO-IPL-2021-Player-Auction-List.pdf](https://web.archive.org/web/20210211155747/https://resources.platform.iplt20.com/IPL/document/2021/02/11/c467e02f-05b8-43c6-bd00-0fab10c0974b/VIVO-IPL-2021-Player-Auction-List.pdf) ("11-2-21", 292), linked from news 228297 | same fields as 2020 |

Official results (iplt20.com):

| Auction | Source (capture) | Gave |
|---|---|---|
| 2018–2021 | current site `/auction/{year}`: [2018](https://web.archive.org/web/20240118022816/https://www.iplt20.com/auction/2018), [2019](https://web.archive.org/web/20240118022814/https://www.iplt20.com/auction/2019), [2020](https://web.archive.org/web/20240118022816/https://www.iplt20.com/auction/2020), [2021](https://web.archive.org/web/20240118022815/https://www.iplt20.com/auction/2021) (18 Jan 2024) | sold players per team (name, type, price), unsold players (name, type, reserve), funds remaining / overseas / squad size per team. No nationality, no reserve for sold players, no RTM mark |
| 2019–2021 | data feeds of the old site's auction page (feed URL in the page's [ipl_auction widget](https://web.archive.org/web/20200806035352/https://www.iplt20.com/resources/ver/widgets/ipl_auction.min.js)): [auction_2019.js](https://web.archive.org/web/20201007165312/http://datacdn.iplt20.com/dynamic/data/core/cricket/2012/ipl2019/auction_2019.js), [auction_2020.js](https://web.archive.org/web/20200806035356/http://datacdn.iplt20.com/dynamic/data/core/cricket/2012/ipl2020/auction_2020.js), [auction_2021.js](https://web.archive.org/web/20210421053832/http://datacdn.iplt20.com/dynamic/data/core/cricket/2012/ipl2021/auction_2021.js) | every pool record: name, Indian / Overseas, speciality, reserve, status (S sold, U unsold, A not reached), hammer price, franchise, RTM flag; per team the purse before the auction, purse left and the Indian / overseas squad before and after. Sold, unsold and funds equal the current-site pages. No 2018 feed is archived |
| 2018–2021 | old-site auction page headers (official summary text): [2018 post](https://web.archive.org/web/20180130183723/http://www.iplt20.com/auction/2018); [2019 post](https://web.archive.org/web/20181219001242/https://www.iplt20.com/auction/2019); [2020 auction morning](https://web.archive.org/web/20191219035503/https://www.iplt20.com/auction/2020), [2020 post](https://web.archive.org/web/20191221103721/https://www.iplt20.com/auction/2020); [2021 pre](https://web.archive.org/web/20210212163622/https://www.iplt20.com/auction/2021), [2021 post](https://web.archive.org/web/20210223032042/https://www.iplt20.com/auction/2021) | 2018: 169 players for 182 slots, 113 Indian (71 uncapped), 56 overseas; 2019: 70 spots, 60 bought incl. 20 overseas, ₹1,06,80,00,000; 2020: "338 players to go under the hammer", then 62 sold (29 overseas, 33 Indian); 2021: "292 players", then 57 players for 61 slots, 22 overseas |

Official advisories (purses, slots, rules):

| Auction | Advisory (capture) | Gave |
|---|---|---|
| 2018 | news 112745 [IPL Player Policies declared for 2018 season](https://web.archive.org/web/20180102140547/http://www.iplt20.com/news/112745/ipl-player-policies-declared-for-2018-season) | salary cap ₹80 Cr; up to 5 players by retention + RTM; squad 18–25 with at most 8 overseas |
| 2018 | news 113790 [VIVO IPL 2018 Player Retention](https://web.archive.org/web/20180104175748/http://www.iplt20.com/news/113790/vivo-ipl-2018-player-retention-announced) (4 Jan 2018) | the 18 retained players (6 overseas), salary cap remaining per team (CSK 47, DD 47, KXIP 67.5, KKR 59, MI 47, RR 67.5, RCB 49, SRH 59 Cr), RTM cards available (2 / 2 / 3 / 3 / 2 / 3 / 2 / 3) |
| 2018 | news 113979 [578 players to go under the hammer](https://web.archive.org/web/20180123162201/http://www.iplt20.com:80/news/113979/578-players-to-go-under-the-hammer-at-vivo-ipl-2018-player-auction) (20 Jan 2018) | 578 players, 182 slots; 62 capped / 298 uncapped Indians, 182 capped / 34 uncapped overseas, 2 associate; reserve-price breakdown |
| 2018 | news 114463 [Eight franchises buy 169 players](https://web.archive.org/web/20180201070237/http://www.iplt20.com:80/news/114463/eight-franchises-buy-169-players-at-vivo-ipl-2018-player-auction) (30 Jan 2018) | 169 sold, 113 Indian, 56 overseas, "RTM cards used – 19", players and purse spent (retention + auction) per team |
| 2019 | news 149387 [VIVO IPL 2019 Player Contract extensions announced](https://web.archive.org/web/20181116002541/https://www.iplt20.com/news/149387/vivo-ipl-2019-player-contract-extensions-announced) (15 Nov 2018) | per team: players, overseas, money spent, salary cap available, slots, overseas slots (₹145.25 Cr, 70, 20; equal to the feed) |
| 2019 | news 149678 [VIVO IPL 2019 Player Auction list announced](https://web.archive.org/web/20181211184215/https://www.iplt20.com/news/149678/vivo-ipl-2019-player-auction-list-announced) (11 Dec 2018) | 346 players, Jaipur 18 Dec 2018, reserve-price breakdown, link to news 149676 |
| 2020 | news 197813 [VIVO IPL 2020 Player Contract extensions announced](https://web.archive.org/web/20191116082807/https://www.iplt20.com/news/197813/vivo-ipl-2020-player-contract-extensions-announced) (15 Nov 2019) | per-team table (₹207.65 Cr, 73 slots, 29 overseas; equal to the feed) |
| 2020 | news 200294 [VIVO IPL 2020 Player Auction list announced](https://web.archive.org/web/20191213144710/https://www.iplt20.com/news/200294/vivo-ipl-2020-player-auction-list-announced) (12 Dec 2019) | 332 players (186 Indian, 143 overseas, 3 associate), Kolkata 19 Dec 2019, reserve breakdown, link to the PDF |
| 2021 | news 228284 [IPL 2021 Player Retentions list](https://web.archive.org/web/20210120221738/https://www.iplt20.com/news/228284/ipl-2021-player-retentions-list) (20 Jan 2021) | retained / released players and the per-team table (₹196.60 Cr, 61 slots, 22 overseas) |
| 2021 | news 228297 [VIVO IPL 2021 Player Auction list announced](https://web.archive.org/web/20210211161309/https://www.iplt20.com/news/228297/vivo-ipl-2021-player-auction-list-announced) (11 Feb 2021) | 292 players (164 Indian, 125 overseas, 3 associate), Chennai 18 Feb 2021, the same per-team table, link to the PDF |

Other sources, used only where the official pages are silent:

| Source | Used for |
|---|---|
| ESPNcricinfo [IPL 2018 player auction: list of sold and unsold players](https://web.archive.org/web/20180203010923/http://www.espncricinfo.com/story/_/id/22218394/ipl-2018-player-auction-list-sold-unsold-players) | the 19 right-to-match buys (= the official count; no archived official page marks them); the reserve of every sold 2018 player (all 169 equal the list); players called and left unsold |
| ESPNcricinfo lists [2019](https://web.archive.org/web/20210420185843/https://www.espncricinfo.com/print/story/1166896), [2020](https://web.archive.org/web/20210423000623/https://www.espncricinfo.com/print/story/1210538), [2021](https://web.archive.org/web/20210220233654/https://www.espncricinfo.com/print/story/1252152) | cross-check of every sale (all equal the feed except one 2021 line, Fabian Allen under SRH; feed, page and team purses: PBKS); 2019: Qais Ahmad called and unsold |
| ESPNcricinfo [Mark Wood withdraws from IPL auction](https://web.archive.org/web/20210217182559/https://www.espncricinfo.com/story/ipl-auction-2021-mark-wood-withdraws-from-ipl-auction-1252134) (17 Feb 2021) | his withdrawal (he is also absent from the feed and the page) |
| ESPNcricinfo profile [Rahmat Shah](https://web.archive.org/web/20210411083211/https://www.espncricinfo.com/player/rahmat-shah-533956) | country of a 2018 addition (the 2018 page has no nationality and no official list carries him) |
| iplt20.com player profiles: [Chris Gayle](https://web.archive.org/web/20251112144425/https://www.iplt20.com/players/chris-gayle/236), [Yuvraj Singh](https://web.archive.org/web/20251207042106/https://www.iplt20.com/players/yuvraj-singh/113), [Parthiv Patel](https://web.archive.org/web/20250805125528/https://www.iplt20.com/players/parthiv-patel/44), [Sanju Samson](https://web.archive.org/web/20251028005149/https://www.iplt20.com/players/sanju-samson/258), [Rashid Khan](https://web.archive.org/web/20251028012105/https://www.iplt20.com/players/rashid-khan/2885), [Shubman Gill](https://web.archive.org/web/20251212072026/https://www.iplt20.com/players/shubman-gill/3761), [Jofra Archer](https://web.archive.org/web/20251214012409/https://www.iplt20.com/players/jofra-archer/3502), [Axar Patel](https://web.archive.org/web/20251214022744/https://www.iplt20.com/players/axar-patel/1113), [Lasith Malinga](https://web.archive.org/web/20251214022031/https://www.iplt20.com/players/lasith-malinga/211), [Ruturaj Gaikwad](https://web.archive.org/web/20251214005356/https://www.iplt20.com/players/ruturaj-gaikwad/5443) | date of birth of 11 sold 2018 / 2019 rows (10 players) that no official list with a DOB covers; no capture was found for the other sold ones |
| Official lists 2020–2025 (the two PDFs above and the 2022–2025 lists under "Sources") | DOB and batting / bowling style of 2018 / 2019 rows and of players added after a list |

### What the files are built from

- **Rows**: the auction-day pool in official list order, players added after the list appended in
  the order of the official page / feed (`list_no`, `set_no`, `set_code` blank for them). A listed
  player missing from the official page / feed stays in the file as unsold unless he is known to have
  withdrawn (only Mark Wood, 2021): the 2018 page and the 2019 feed are incomplete (see below).
- **status, team, price_lakh**: 2018 the current-site page (cross-checked line by line with
  ESPNcricinfo: same team and price for all 169); 2019–2021 the feed (= the page).
- **base_lakh**: the list's reserve, replaced by the auction-day reserve of the page / feed where they
  differ and the auction-day value is a reserve tier of the player's status (apart from Alex Carey
  2018, every Capped player of the four lists is at 50 L or more and every Uncapped / Associate one at
  40 L or less): only Alex Carey, 2018 (list "Capped" at 30 L, page 50 L). Kept as listed where the
  page / feed value fits no tier: Ishwar Pandey 2018 (page 25 L), Jeevan Mendis 2019 (feed 30 L,
  capped), Nehal Pajni 2020 and Jacques Snyman 2021 (feed 50 L, uncapped; the 2021 announcement's tier
  counts equal the list).
- **rtm**: 2018 the 19 buys ESPNcricinfo flags as right-to-match (= the official 19; per team within
  the RTM cards of news 113790: CSK 2, DD 2, KXIP 3, KKR 3, MI 2, RR 2, RCB 2, SRH 3); 0 for
  2019–2021 (no RTM at these mini auctions; every feed record has `bought_via_rtm` false).
- **name, country, overseas, capped, role**: from the list (BATSMAN → BATTER; C/U/A lower case). For
  players added after the list: name and overseas flag from the feed / page, country from another
  official list (Rahmat Shah: ESPNcricinfo), `capped` from the reserve tier (50 L or more: capped).
- **dob, age, styles, caps**: 2020 and 2021 exactly as printed. The 2018 and 2019 lists print no DOB,
  age, styles or international caps: `dob`, `batting_style` and `bowling_style` come from the same
  player's row in the 2020–2025 official lists (same country; the same words of the name in any order,
  or one name's words all inside the other's; exactly one DOB among the candidates; for a name close
  to another player of the same list, role and state must also agree; a day/month swap between lists
  takes the latest list; a DOB held by three quarters of the rows is taken when the others are one
  character off), else, for sold players, the iplt20.com profile; `age`, `test_caps`, `odi_caps`,
  `t20i_caps` blank; `ipl_caps` as printed in 2018, blank in 2019. Borrowed styles use the wording of
  the latest list holding the player (2022+ "Off Spin" / "Leg Spin"; 2020–21 "Off Break" / "Leg Break").
- **lot_no / list_no / sets**: `lot_no` 1..N; `list_no` the printed serial (2018, 2020, 2021; the 2019
  table prints none, so `list_no`, `set_no` and `set_code` are blank there and `lot_no` keeps its row
  order).
- **markets.csv** rows: total purse = sum of the per-team purses before the auction (2018: retention
  advisory; 2019 and 2020: contract-extension advisories, equal to the feed team by team; 2021: the
  retention advisory's total, equal to the feed's, whose CSK / RR and DC / RCB purses and squads already
  include trades made after the advisory); slots and overseas slots from the same advisories (2018
  overseas slots = 8 per team − the 6 retained overseas players, per the 2018 policy; no 2018 advisory
  states it); `players_in_list` = rows of the file; `date` = first auction day.

### Validation

| Auction | Rows | Sold (ours / official) | Overseas sold | Spend ₹ Cr (ours / official) | Teams reconciled |
|---|---|---|---|---|---|
| 2018 mega | 581 | 169 / 169 (RTM 19 / 19; Indian 113 / 113, of whom uncapped 71 / 71) | 56 / 56 | 431.70; every team's retention + auction spend equals the official "purse spent" | 8 / 8 |
| 2019 mini | 352 | 60 / 60 | 20 / 20 | 106.80 / 106.80 | 8 / 8 |
| 2020 mini | 338 | 62 / 62 (Indian 33 / 33) | 29 / 29 | 140.30 / 140.30 (feed purses) | 8 / 8 |
| 2021 mini | 298 | 57 / 57 | 22 / 22 | 145.30 / 145.30 (feed purses) | 8 / 8 |

"Teams reconciled": purse before the auction − our spend = funds remaining on the page (and in the
feed), squad before + bought = squad after, and the same for overseas players, for every team.
Per-team spend (₹ Cr):

| Auction | CSK | DC | KKR | MI | PBKS | RR | RCB | SRH |
|---|---|---|---|---|---|---|---|---|
| 2018 | 40.50 | 45.40 | 59.00 | 46.35 | 67.40 | 65.85 | 48.85 | 58.35 |
| 2019 | 5.20 | 17.80 | 9.15 | 7.60 | 32.50 | 13.80 | 16.35 | 4.40 |
| 2020 | 14.45 | 18.85 | 27.15 | 11.10 | 26.20 | 14.15 | 21.50 | 6.90 |
| 2021 | 17.35 | 11.25 | 7.55 | 11.70 | 34.40 | 24.20 | 35.05 | 3.80 |

Other checks: list composition equals each announcement (2018: 62 / 298 / 182 / 34 / 2 and the
reserve tiers, except that the list prints Alex Carey "Capped" at 30 L; 2020 and 2021 exactly);
`lot_no` unique 1..N; teams only CSK, DC, KKR, MI, PBKS, RR, RCB, SRH; no player twice (same-name
different people, kept apart by list number and role: 2018 three Amit Mishra, two Mandeep Singh, two
Lalit Yadav; 2020 two Lalit Yadav, two Sumit Kumar); no price below the reserve.

**Bid ladder.** 2020 and 2021: every sale above the reserve is on the published ladder (+5 L to
₹1 Cr, +10 L to ₹2 Cr, +20 L to ₹5 Cr, +25 L above). 2018 and 2019 used **20 L steps up to ₹10 Cr**
(the ladder inferred for 2024 in RULES.md): 20 sales in 2018 and 4 in 2019 between ₹5 and ₹10 Cr are
multiples of 20 L but not of 25 L (₹5.20, 5.40, 5.60, 5.80, 6.20, 6.40, 7.20, 7.40, 7.60, 7.80, 8.40,
8.80, 9.40, 9.60 Cr), and the four 2018 sales above ₹10 Cr (₹11.00, 11.00, 11.50, 12.50 Cr) are
multiples of 25 L; every 2018 / 2019 sale fits that ladder. In 2020–2021 eight sales between ₹5 and
₹10 Cr are not multiples of 20 L (₹5.25, 5.50, 6.75, 7.75, 8.50, 9.25 Cr), so the 25 L step above
₹5 Cr was in force from 2020. Inferred from the official prices only; no ladder for these years was
found in an official source.

### Changes between list and auction day, conflicts and decisions

- **2018.** Added after the list (on the page only): Rahmat Shah Zarmatai (Afghanistan, 50 L), Utkarsh
  Singh and Pratham Singh (20 L). The page holds second records of three players: Mohammed Shami (sold
  to DD by RTM; his list record also shows as unsold at 1 Cr), Mandeep Singh ("Mandeep Hardev Singh",
  unsold) and Puneet Datey ("Puneed Datey"). RCB's ₹1.4 Cr Mandeep Singh is list no. 128, the capped
  Punjab batsman (ESPNcricinfo gives his reserve as 50 L); the page's sold record carries the
  All-Rounder label of the uncapped namesake (no. 529), who is kept as unsold. Harpreet Bhatia (no. 234)
  and Lalit Yadav (no. 330) have no page record although ESPNcricinfo lists a Harpreet Bhatia and a
  Lalit Yadav among the players called and left unsold: kept as unsold. "Manpreet Grewal" (no. 375,
  capped, 44 IPL caps) is Manpreet Gony on the page; "Samarth Kumar" (no. 240) is R Samarth.
- **2019.** The announcement says 346 players; the complete-list table has 351 (+1 at 2 Cr, +1 at 50 L,
  +1 at 40 L, +2 at 20 L; no capture before 16 Apr 2019 exists, so the five cannot be dated). The
  archived feed (captured Oct 2020) and the 2024 page hold 362 records: 12 are second records of
  listed players (Seth Rance three times, Ryan McLaren, Swapnil Gugale, Sheldon Cottrell, Sai Kishore,
  Tanveer Ul Haq, Shams Mulani, Lalit Yadav, Arun Karthick, R Sanjay Yadav, Harpreet Bhatia; five carry
  record ids of the 2020 auction), one is an addition (James Fuller, 40 L, unsold), and two listed
  players are missing: Qais Ahmad (called and unsold per ESPNcricinfo) and Tanush Kotian (no evidence
  either way); both kept as unsold.
- **2020.** Six added after the 11-12-19 list (record ids 4637–4643 follow the list's): Matthew Wade,
  Ashoke Dinda, R Vinay Kumar ("Vinay Kumar"; called and unsold per ESPNcricinfo), Jake Weatherald,
  Robin Bist and Sanjay Yadav (sold to SRH at 20 L); the official auction-morning page says 338.
- **2021.** Mark Wood (no. 24, 2 Cr) withdrew on 17 Feb: not in the file. Seven added after the 11-2-21
  list (ids 4969–4975): Xavier Bartlett, Mushfiqur Rahim, Rohit Damodaran, Jiyas K, Mayank Dagar, Ashok
  Menaria and Saurabh Kumar (sold to PBKS at 20 L). List no. 279 "Ajay T" (JSCA) is the feed's "Rahul
  Ajay Tripathy" (its record id sits between those of nos. 278 and 280). Nayan Doshi: list England
  (ECB), feed "Indian"; the list is kept (overseas = 1).
- **Names** are kept as printed in the list (e.g. 2018 "Vijay Murali", "Gowtham Krishnappa", "Faf Du
  Plessis", "Rashid Khan Arman"); additions as on the page / feed. Page and feed spellings that differ
  were paired by name similarity plus reserve, role and nationality; every non-exact pair was
  reviewed, and the hard ones are in `.cache/parsed1821/manual_join.csv`.

### Gaps

- **Date of birth missing**: 2018 213 of 581 rows (sold 16 of 169: Kieron Pollard, Gautam Gambhir,
  Brendon McCullum, Shane Watson, Mitchell Johnson, Suryakumar Yadav, R Vinay Kumar, Bipul Sharma, JP
  Duminy, Mehdi Hasan, MD Nidheesh, Monu Singh, Manzoor Dar, Jatin Saxena, Javon Searless, Aryaman
  Birla); 2019 94 of 352 (sold 6 of 60: Nathu Singh, Joe Denly, Harry Gurney, Milind Kumar, Agnivesh
  Ayachi, Shrikant Mundhe); 2020 3 and 2021 2 (unsold additions: Ashoke Dinda, Robin Bist, Vinay Kumar;
  Jiyas K, Ashok Menaria). No official list with a DOB covers them and no iplt20.com profile capture
  was found.
- 2018 / 2019: no age, styles or international caps from their own lists; 2019 no list numbers, sets
  or IPL caps; the 2018 overseas slots are derived; the 2018 RTM flags rest on ESPNcricinfo.
- The feeds' status A ("not reached") vs U would show which unsold players were called; the schema has
  no column for it, and in 2019 it is unreliable (two players ESPNcricinfo lists as called are A).

### Name mapping

`pipeline/register.py` SOURCES now holds `auction_2018` … `auction_2021`; `python -m pipeline.register`
gives name_map.csv 1679 keys (1316 matched) and unmatched.csv 363. Every lookup of the existing files
(auction_2022–2025, pool_2026, retained_2024/2026: 2629 rows) is unchanged against the map before.

| File | Rows matched | Sold rows matched | Unmatched sold |
|---|---|---|---|
| auction_2018 | 522 / 581 | 167 / 169 | MD Nidheesh (no DOB; the 2018 spelling "Nidheesh M D Dinesan" is not tied to his Cricsheet record), Aryaman Birla (no Cricsheet record) |
| auction_2019 | 328 / 352 | 59 / 60 | Agnivesh Ayachi (no Cricsheet record) |
| auction_2020 | 323 / 338 | 61 / 62 | Prince Balwant Rai Singh (no Cricsheet record) |
| auction_2021 | 286 / 298 | 57 / 57 | – |

Keeping the existing lookups unchanged took two things: (1) `cluster()` no longer attaches a DOB-less
squad row to the only dated namesake when every player of that name on the row's IPL team sheets has
a birthday that conflicts with the namesake's (`squad_contradicts`); without it MI's retained Rohit
Sharma merges with the uncapped Rohit Sharma of the 2021 list (born 28/06/1993) and loses his id, and
with the four new files left out the change alters no lookup; (2) a seventh override, Adam Zampa (the
2020 list prints 31/03/1992, the 2022, 2023 and 2025 lists 31/12/1992). Unsold, DOB-less rows matched
on the name alone that may be someone else: 2018 Mandeep Singh no. 529 (uncapped all-rounder) shares
the capped Mandeep Singh's id; 2019 Rajesh Bishnoi (bowler) shares the id of the 2020–21 lists'
Rajesh Bishnoi (born 1987, batsman, the 2019 list's "Rajesh Bishnoi Sr"); 2019 Gurinder Singh
(Meghalaya) shares the id of the 2020 list's Gurinder Singh (Uttarakhand).
