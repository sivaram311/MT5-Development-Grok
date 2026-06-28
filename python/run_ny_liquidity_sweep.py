#!/usr/bin/env python3
"""Run NY Liquidity Sweep publisher or historical backfill."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mt5_xauusd.liquidity_sweep_service import main

if __name__ == "__main__":
    main()
