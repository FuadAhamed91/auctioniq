"""Loads config.toml once. Every module imports CFG and ROOT from here."""
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CFG = tomllib.loads((ROOT / "config.toml").read_text(encoding="utf-8"))
