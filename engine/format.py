"""Money formatting shared by the engine's reason texts."""


def money(lakhs: float) -> str:
    lakhs = int(round(lakhs))
    return f"₹{lakhs} L" if lakhs < 100 else f"₹{lakhs / 100:.2f} Cr"
