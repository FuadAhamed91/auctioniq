"""Auction rules: the bid ladder and the purse reserve."""
from config import CFG

RULES = CFG["rules"]


def next_bid(price: int) -> int:
    """The next price point above `price` (lakhs): the next multiple of the band's step, so a
    ₹1.25 Cr base goes on to ₹1.30 Cr, as in the official sale prices."""
    for up_to, step in RULES["increments"]:
        if price < up_to:
            return (price // step + 1) * step
    raise ValueError(price)


def max_bid(purse: int, squad: int) -> int:
    """Most a team may bid and still afford ₹30 L for every minimum slot left after this one."""
    unfilled_after = max(0, RULES["min_squad"] - squad - 1)
    return purse - RULES["reserve_per_slot"] * unfilled_after
