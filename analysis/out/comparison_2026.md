# AuctionIQ vs the real IPL 2026 auction

369 players in the list, 77 sold in reality. Simulation: 1000 runs with only pre-auction data. Each metric shows the estimate and a bootstrap 95% interval (players resampled, 2,000 draws).

## Metrics

| Model | MAE on log price | Spearman (price) | Sold/unsold AUC | Real buyer in top 3 | 80% range coverage |
|---|---|---|---|---|---|
| AuctionIQ | 0.677 [0.509, 0.872] | 0.667 [0.512, 0.795] | 0.808 [0.750, 0.857] | 0.448 [0.341, 0.560] | 0.727 [0.622, 0.823] |
| Base price | 0.615 [0.407, 0.838] | 0.642 [0.463, 0.802] | 0.623 [0.552, 0.689] | – | 0.649 [0.545, 0.750] |
| Last IPL price | 0.808 [0.603, 1.007] | 0.571 [0.395, 0.722] | 0.611 [0.541, 0.676] | – | 0.364 [0.262, 0.472] |
| Value without needs | 0.706 [0.548, 0.879] | 0.679 [0.525, 0.796] | 0.804 [0.746, 0.854] | 0.444 [0.338, 0.554] | 0.688 [0.580, 0.789] |

Pre-auction needs, no simulation: the real buyer was one of the three neediest teams in 42% of the 77 buys (30% by chance); the buyer's need gate was open in 77% of buys, against 74% of all teams for the same players.

MAE and Spearman use players sold in reality (simulated median price given sold; base price if never sold in a run). Coverage = real price inside the simulated 10th–90th percentile. Top 3 = the real buyer is among the three teams that bought him most often. The 2024 numbers in the app are tuning-set fits; this is the held-out test.

## Biggest misses

| Player | Real (₹ L) | Buyer | Sim median | 80% range | P(sold) | log error |
|---|---|---|---|---|---|---|
| Kartik Sharma | 1420 | CSK | 35 | 30–90 | 0.39 | +3.70 |
| Prashant Veer | 1420 | CSK | 60 | 30–240 | 0.74 | +3.16 |
| Auqib Dar | 840 | DC | 40 | 30–140 | 0.48 | +3.04 |
| Mangesh Yadav | 520 | RCB | 40 | 30–130 | 0.44 | +2.56 |
| Tejasvi Singh | 300 | KKR | 35 | 30–90 | 0.33 | +2.15 |
| Mukul Choudhary | 260 | LSG | 35 | 30–84 | 0.38 | +2.01 |
| Akshat Raghuwanshi | 220 | LSG | 30 | 30–55 | 0.18 | +1.99 |
| Wanindu Hasaranga | 200 | LSG | 1300 | 360–2500 | 0.96 | -1.87 |
| Jack Edwards | 300 | SRH | 50 | 50–79 | 0.01 | +1.79 |
| Salil Arora | 150 | SRH | 30 | 30–55 | 0.17 | +1.61 |
| Josh Inglis | 860 | LSG | 200 | 200–354 | 0.15 | +1.46 |
| Pathum Nissanka | 400 | DC | 95 | 75–220 | 0.22 | +1.44 |

Sold although P(sold) < 0.2: Ben Dwarshuis, Jordan Cox, Josh Inglis, Tim Seifert, Kyle Jamieson, Adam Milne, Lungisani Ngidi, Danish Malewar, Aman Rao Perala, Akshat Raghuwanshi, Aman Khan, Salil Arora, Ravi Singh, Prithviraj Yarra, Pravin Dubey, Cooper Connolly, Luke Wood, Sahil Parakh, Amit Kumar, Vishal Nishad, Atharva Ankolekar, Praful Hinge, Krains Fuletra, Vihaan Malhotra, Sarthak Ranjan, Brijesh Sharma, Kanishk Chouhan, Daksh Kamra, Jack Edwards
Unsold although P(sold) > 0.8: Devon Conway, Jake Fraser-McGurk
