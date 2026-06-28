"""Compare grok_dev RSI vs MT5 bar data and probe indicator API."""
import sys
from datetime import datetime, timezone

sys.path.insert(0, ".")
import MetaTrader5 as mt5
import pandas as pd

from mt5_xauusd.config import BROKER_SERVER_ZONE, SYMBOL
from mt5_xauusd.order_rsi_service import MT5_TF_MAP, OrderRsiPublisher
from mt5_xauusd.rsi_util import wilder_rsi_forming_and_completed

PRICE_CLOSE = 1


def mt5_builtin_rsi(symbol: str, tf: int, shift: int, period: int = 14) -> float | None:
    """Read MT5 built-in iRSI via copy_buffer when available."""
    if not hasattr(mt5, "iRSI"):
        return None
    handle = mt5.iRSI(symbol, tf, period, PRICE_CLOSE)
    if handle is None:
        return None
    buf = mt5.copy_buffer(handle, 0, shift, 1)
    mt5.indicator_release(handle)
    if buf is None or len(buf) == 0:
        return None
    return float(buf[0])


def main():
    if not mt5.initialize():
        print("MT5 init failed:", mt5.last_error())
        return 1

    tick = mt5.symbol_info_tick(SYMBOL)
    info = mt5.symbol_info(SYMBOL)
    print("=== MT5 ENV ===")
    print(f"symbol={SYMBOL} chart_mode={info.chart_mode} (0=bid 1=last)")
    print(f"tick bid={tick.bid} ask={tick.ask} last={tick.last}")
    print(f"BROKER_SERVER_ZONE={BROKER_SERVER_ZONE}")
    print(f"has iRSI API: {hasattr(mt5, 'iRSI')}")

    pub = OrderRsiPublisher()
    snap = pub.build_snapshot(float(tick.bid))

    for tf_key in ["M1", "M5", "H1", "D1"]:
        mt5_tf = MT5_TF_MAP[tf_key]
        rates = mt5.copy_rates_from_pos(SYMBOL, mt5_tf, 0, 5000)
        df = pd.DataFrame(rates).sort_values("time")
        bar_close = float(df["close"].iloc[-1])
        bid = float(tick.bid)

        raw = df["close"].astype(float).tolist()
        tick_ovr = raw.copy()
        tick_ovr[-1] = bid

        rsi0_raw, rsi1_raw = wilder_rsi_forming_and_completed(raw, 14)
        rsi0_tick, rsi1_tick = wilder_rsi_forming_and_completed(tick_ovr, 14)

        app = snap["timeframes"].get(tf_key, {})
        bar_utc = datetime.fromtimestamp(int(df["time"].iloc[-1]), tz=timezone.utc)

        mt5_s0 = mt5_builtin_rsi(SYMBOL, mt5_tf, 0)
        mt5_s1 = mt5_builtin_rsi(SYMBOL, mt5_tf, 1)

        print(f"\n--- {tf_key} ---")
        print(f"  bar UTC open: {bar_utc}")
        print(f"  MT5 shift0 close: {bar_close:.5f}  live bid: {bid:.5f}")
        print(f"  APP     shift0={app.get('rsi')} shift1={app.get('completed', {}).get('rsi')}")
        print(f"  RECOMP  raw     shift0={rsi0_raw:.2f} shift1={rsi1_raw:.2f}")
        print(f"  RECOMP  tick_ovr shift0={rsi0_tick:.2f} shift1={rsi1_tick:.2f}")
        if mt5_s0 is not None:
            print(f"  MT5 iRS shift0={mt5_s0:.2f} shift1={mt5_s1:.2f}")
            print(f"  delta raw s0 vs MT5: {rsi0_raw - mt5_s0:+.2f}")
            print(f"  delta raw s1 vs MT5: {rsi1_raw - mt5_s1:+.2f}")
            print(f"  delta tick s0 vs MT5: {rsi0_tick - mt5_s0:+.2f}")

    mt5.shutdown()
    pub.mt5.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
