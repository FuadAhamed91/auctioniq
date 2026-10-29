from engine.rules import max_bid, next_bid


def test_ladder_steps():
    assert next_bid(125) == 130   # price points are multiples of the band's step
    assert next_bid(30) == 35
    assert next_bid(95) == 100
    assert next_bid(100) == 110
    assert next_bid(190) == 200
    assert next_bid(200) == 220
    assert next_bid(480) == 500
    assert next_bid(500) == 525
    assert next_bid(2475) == 2500


def test_ladder_from_every_base_stays_on_grid():
    for base in (30, 40, 50, 75, 100, 125, 150, 200):
        p, seen = base, [base]
        while p < 3000:
            p = next_bid(p)
            seen.append(p)
        steps = {b - a for a, b in zip(seen, seen[1:])}
        assert steps <= {5, 10, 20, 25}


def test_reserve_keeps_money_for_minimum_squad():
    assert max_bid(4340, 16) == 4340 - 30      # 16 now, 17 after this buy -> one more at 30 L
    assert max_bid(1000, 10) == 1000 - 7 * 30  # 11 after this buy -> seven more
    assert max_bid(275, 20) == 275             # already past the minimum

