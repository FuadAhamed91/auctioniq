"""Download raw inputs: Cricsheet ball-by-ball archives, the Cricsheet register and
cricketdata's player_meta (exported to CSV once, then committed).

    python -m pipeline.fetch
"""
import urllib.request
from pathlib import Path

from config import CFG, ROOT

RAW = ROOT / "data" / "raw"


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  have {dest.name}")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "AuctionIQ/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp, open(tmp, "wb") as out:
        while chunk := resp.read(1 << 20):
            out.write(chunk)
    tmp.replace(dest)
    print(f"  got  {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")


def export_player_meta() -> None:
    """One-time export of cricketdata::player_meta (an .rda file) to data/player_meta.csv."""
    out = ROOT / "data" / "player_meta.csv"
    if out.exists():
        print("  have player_meta.csv")
        return
    import pyreadr  # only needed for this one-time export

    rda = RAW / "player_meta.rda"
    download(CFG["data"]["player_meta_rda"], rda)
    frame = next(iter(pyreadr.read_r(str(rda)).values()))
    frame.to_csv(out, index=False)
    print(f"  wrote player_meta.csv ({len(frame)} rows)")


def main() -> None:
    print("Cricsheet archives")
    for code in CFG["data"]["competitions"]:
        download(f"{CFG['data']['cricsheet']}{code}_male_json.zip", RAW / "cricsheet" / f"{code}.zip")
    print("Cricsheet register")
    for name in ("people.csv", "names.csv"):
        download(CFG["data"]["register"] + name, RAW / "register" / name)
    print("cricketdata player_meta")
    export_player_meta()


if __name__ == "__main__":
    main()
