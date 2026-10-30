# AuctionIQ vs the real IPL 2026 auction, after seeing the results

> **Run after seeing the 2026 results.** After the first comparison (comparison_2026.md, the honest held-out test), the model gained a pre-auction buzz signal for uncapped players and was re-tuned on the 2024 back-test only. The buzz research used only sources dated before the auction, but it was gathered after the auction took place, so this is not a clean held-out test.

369 players in the list, 77 sold in reality. Simulation: 1000 runs with only pre-auction data. Each metric shows the estimate and a bootstrap 95% interval (players resampled, 2,000 draws).

## Metrics

| Model | MAE on log price | Spearman (price) | Sold/unsold AUC | Real buyer in top 3 | 80% range coverage |
|---|---|---|---|---|---|
| AuctionIQ | 0.614 [0.463, 0.775] | 0.740 [0.606, 0.838] | 0.811 [0.756, 0.859] | 0.452 [0.344, 0.563] | 0.701 [0.594, 0.800] |
| Base price | 0.615 [0.407, 0.838] | 0.642 [0.463, 0.802] | 0.623 [0.552, 0.689] | – | 0.649 [0.545, 0.750] |
| Last IPL price | 0.808 [0.603, 1.007] | 0.571 [0.395, 0.722] | 0.611 [0.541, 0.676] | – | 0.364 [0.262, 0.472] |
| Value without needs | 0.630 [0.498, 0.772] | 0.756 [0.629, 0.838] | 0.809 [0.751, 0.859] | 0.390 [0.282, 0.500] | 0.688 [0.583, 0.790] |

Pre-auction needs, no simulation: the real buyer was one of the three neediest teams in 42% of the 77 buys (30% by chance); the buyer's need gate was open in 77% of buys, against 74% of all teams for the same players.

MAE and Spearman use players sold in reality (simulated median price given sold; base price if never sold in a run). Coverage = real price inside the simulated 10th–90th percentile. Top 3 = the real buyer is among the three teams that bought him most often. The 2024 numbers in the app are tuning-set fits; this is the held-out test.

## Biggest misses

| Player | Real (₹ L) | Buyer | Sim median | 80% range | P(sold) | log error |
|---|---|---|---|---|---|---|
| Kartik Sharma | 1420 | CSK | 55 | 30–220 | 0.82 | +3.25 |
| Auqib Dar | 840 | DC | 100 | 35–340 | 0.86 | +2.13 |
| Mukul Choudhary | 260 | LSG | 35 | 30–70 | 0.25 | +2.01 |
| Akshat Raghuwanshi | 220 | LSG | 30 | 30–55 | 0.29 | +1.99 |
| Wanindu Hasaranga | 200 | LSG | 1400 | 400–2500 | 0.96 | -1.95 |
| Mangesh Yadav | 520 | RCB | 75 | 30–220 | 0.84 | +1.94 |
| Jack Edwards | 300 | SRH | 50 | 50–52 | 0.01 | +1.79 |
| Prashant Veer | 1420 | CSK | 280 | 90–750 | 0.99 | +1.62 |
| Salil Arora | 150 | SRH | 30 | 30–57 | 0.12 | +1.61 |
| Pathum Nissanka | 400 | DC | 90 | 75–190 | 0.18 | +1.49 |
| Josh Inglis | 860 | LSG | 200 | 200–324 | 0.13 | +1.46 |
| Mustafizur Rahman | 920 | KKR | 220 | 200–500 | 0.49 | +1.43 |

Sold although P(sold) < 0.2: Pathum Nissanka, Ben Dwarshuis, Zak Foulkes, Jordan Cox, Josh Inglis, Tim Seifert, Kyle Jamieson, Adam Milne, Lungisani Ngidi, Danish Malewar, Aman Rao Perala, Aman Khan, Salil Arora, Sakib Hussain, Mohammad Izhar, Onkar Tarmale, Prithviraj Yarra, Pravin Dubey, Cooper Connolly, Luke Wood, Sahil Parakh, Amit Kumar, Vishal Nishad, Atharva Ankolekar, Praful Hinge, Vihaan Malhotra, Sarthak Ranjan, Brijesh Sharma, Kanishk Chouhan, Daksh Kamra, Jack Edwards
Unsold although P(sold) > 0.8: Devon Conway, Jake Fraser-McGurk, Raj Limbani, Sairaj Patil
