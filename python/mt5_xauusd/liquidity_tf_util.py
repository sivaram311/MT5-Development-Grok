"""Timeframe helpers for NY Liquidity Sweep analyzer."""

from __future__ import annotations

from typing import Dict, List, Tuple

TF_MINUTES: Dict[str, int] = {
    "M1": 1,
    "M5": 5,
    "M15": 15,
    "H1": 60,
    "H4": 240,
    "D1": 1440,
}

ENTRY_TFS = ("M15", "M1")
HTF_OPTIONS = ("D1", "H4", "H1", "M15")
LTF_OPTIONS = ("M15", "M1")

# Curated presets shown in the UI (htf minutes must exceed ltf).
TF_PRESETS: List[Dict[str, str]] = [
    {"id": "h1-m15-m15", "label": "H1 → M15 (M15 entry)", "htf": "H1", "ltf": "M15", "entry": "M15"},
    {"id": "h1-m1-m1", "label": "H1 → M1 (M1 entry)", "htf": "H1", "ltf": "M1", "entry": "M1"},
    {"id": "m15-m1-m1", "label": "M15 → M1 (M1 entry)", "htf": "M15", "ltf": "M1", "entry": "M1"},
    {"id": "h4-m15-m15", "label": "H4 → M15 (M15 entry)", "htf": "H4", "ltf": "M15", "entry": "M15"},
    {"id": "h4-m1-m1", "label": "H4 → M1 (M1 entry)", "htf": "H4", "ltf": "M1", "entry": "M1"},
]


def tf_minutes(tf: str) -> int:
    if tf not in TF_MINUTES:
        raise ValueError(f"Unsupported timeframe: {tf}")
    return TF_MINUTES[tf]


def is_valid_tf_pair(htf: str, ltf: str) -> bool:
    return htf in TF_MINUTES and ltf in TF_MINUTES and tf_minutes(htf) > tf_minutes(ltf)


def normalize_tf_config(entry_tf: str, htf: str, ltf: str) -> Tuple[str, str, str]:
    entry = entry_tf.upper()
    h = htf.upper()
    l = ltf.upper()
    if entry not in ENTRY_TFS:
        raise ValueError(f"entry_tf must be one of {ENTRY_TFS}")
    if not is_valid_tf_pair(h, l):
        raise ValueError(f"htf ({h}) must be higher than ltf ({l})")
    if tf_minutes(l) > tf_minutes(entry):
        raise ValueError(f"ltf ({l}) cannot be higher than entry ({entry})")
    return entry, h, l
