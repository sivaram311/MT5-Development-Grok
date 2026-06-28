# MQL5 Expert Advisors (Grok Dev)

Source and pre-built EAs for the MT5 ↔ Python ↔ Angular bridge. All JSON exports go to **Terminal → Common → Files** (`%APPDATA%\MetaQuotes\Terminal\Common\Files\`).

| EA | Purpose | Output file | Pre-built |
|----|---------|-------------|-----------|
| **GrokDevOrderRsiExport** | MT5 built-in `iRSI(14)` shift 0/1 for Analyzer cross-check | `grok_dev_order_rsi_mt5.json` | ✅ `GrokDevOrderRsiExport.ex5` |
| **GrokDevGannScanner** | Gann 1×1 stretch scanner for intraday alerts | `grok_dev_gann_scanner.json` | ✅ `GrokDevGannScanner.ex5` |

---

## Quick install (pre-built EAs)

**Recommended — deploy script (all terminals):**

```powershell
cd E:\Source\grok_dev
.\python\mt5_scripts\deploy-mt5-eas.ps1
```

Deploys **both** `GrokDevOrderRsiExport` and `GrokDevGannScanner` (`.mq5` + `.ex5`) to every `MQL5\Experts` folder under `%APPDATA%\MetaQuotes\Terminal\`.

Single terminal only:

```powershell
.\python\mt5_scripts\deploy-mt5-eas.ps1 -TerminalId 903AFBEA36629AEC9838022C670CC5D2
```

Dry run:

```powershell
.\python\mt5_scripts\deploy-mt5-eas.ps1 -WhatIf
```

### Manual copy (one EA or one terminal)

```powershell
$experts = "$env:APPDATA\MetaQuotes\Terminal\<YOUR_TERMINAL_ID>\MQL5\Experts"
Copy-Item "E:\Source\grok_dev\python\mt5_scripts\GrokDevOrderRsiExport.ex5" $experts -Force
Copy-Item "E:\Source\grok_dev\python\mt5_scripts\GrokDevOrderRsiExport.mq5" $experts -Force
Copy-Item "E:\Source\grok_dev\python\mt5_scripts\GrokDevGannScanner.ex5" $experts -Force
Copy-Item "E:\Source\grok_dev\python\mt5_scripts\GrokDevGannScanner.mq5" $experts -Force
```

Find `<YOUR_TERMINAL_ID>`: open `%APPDATA%\MetaQuotes\Terminal\` — use the folder that contains your `MQL5` directory (e.g. OctaFX / Octa Markets).

### After deploy

1. **MT5** → Navigator → Expert Advisors → right-click → **Refresh**
2. **GrokDevOrderRsiExport** → any **XAUUSD** chart → **Algo Trading** ON → `grok_dev_order_rsi_mt5.json`
3. **GrokDevGannScanner** → **XAUUSD M5/M15** → **Algo Trading** ON → `grok_dev_gann_scanner.json`

**Analyzer:** toggle **MT5 built-in** on `/dashboard/order-rsi` when `mt5ExportAvailable` is true.

Full alignment guide: [docs/order-rsi-mt5-alignment.md](../../docs/order-rsi-mt5-alignment.md)

---

## Compile from source (MetaEditor)

Use when you change `.mq5` source or need the Gann scanner `.ex5`.

### Prerequisites

- MetaTrader 5 installed and logged in at least once (creates `MQL5` data folder)
- **MetaEditor** — typically next to `terminal64.exe`, e.g.:
  - `C:\Program Files\Octa Markets MetaTrader 5\MetaEditor64.exe`
  - `E:\ProgramFiles\MT5\MetaEditor64.exe`

### Command line (PowerShell)

```powershell
$metaEditor = "E:\ProgramFiles\MT5\MetaEditor64.exe"   # adjust path
$src = "E:\Source\grok_dev\python\mt5_scripts"

& $metaEditor /compile:"$src\GrokDevOrderRsiExport.mq5" /log:"$src\GrokDevOrderRsiExport.log"
& $metaEditor /compile:"$src\GrokDevGannScanner.mq5"    /log:"$src\GrokDevGannScanner.log"
```

Check log tail for **`0 errors, 0 warnings`**. Compiled `.ex5` is written **next to the `.mq5`** in `python/mt5_scripts/`.

### MetaEditor GUI

1. Open MetaEditor (F4 from MT5)
2. **File → Open** → `python/mt5_scripts/GrokDevOrderRsiExport.mq5`
3. **Compile** (F7) — expect `0 error(s), 0 warning(s)`
4. Copy `.mq5` + `.ex5` to `MQL5\Experts\` (see quick install)

### Deploy to Experts

```powershell
cd E:\Source\grok_dev
.\python\mt5_scripts\deploy-mt5-eas.ps1
```

Or copy manually:

```powershell
$experts = "$env:APPDATA\MetaQuotes\Terminal\<YOUR_TERMINAL_ID>\MQL5\Experts"
Copy-Item "E:\Source\grok_dev\python\mt5_scripts\GrokDev*.ex5" $experts -Force
Copy-Item "E:\Source\grok_dev\python\mt5_scripts\GrokDev*.mq5" $experts -Force
```

Restart or refresh Navigator if the EA does not appear.

---

## GrokDevOrderRsiExport.mq5 (v2.0)

Exports MT5 terminal `iRSI(14, Close)` for **W1, D1, H4, H1, M15, M5, M1** — shift 0 (forming) and shift 1 (closed).

### Recommended inputs

| Input | Default | Notes |
|-------|---------|-------|
| `InpSymbol` | `XAUUSD` | Validated on attach |
| `InpPeriod` | `14` | Must match chart RSI |
| `InpTimerSec` | `2` | Export attempt interval |
| `InpNewBarOnly` | `false` | `true` = only on M1 bar change (less I/O; Bar 0 RSI updates less often) |
| `InpEnableFileLog` | `false` | Log to `grok_dev_order_rsi_log.txt` |

**Live Bar 0 comparison:** `InpNewBarOnly=false`, `InpTimerSec=2`–`5`.

**Power saving:** `InpNewBarOnly=true` and set Python `MT5_RSI_EXPORT_MAX_AGE=120`.

### v2 features

- Atomic write: `.tmp` → `FileMove` → `grok_dev_order_rsi_mt5.json`
- `updatedAt` in UTC (`TimeGMT`) — read by `mt5_rsi_export.py`
- Symbol validation, guaranteed `IndicatorRelease`, optional file log

### Verify

```powershell
cd E:\Source\grok_dev\python
python scripts/compare_mt5_rsi.py
```

Python publisher: `python run_order_rsi.py` (must be running for Analyzer SSE).

---

## GrokDevGannScanner.mq5 (v1.0)

Lightweight Gann 1×1 stretch export for optional MT5-side scanning.

### Attach

1. Copy pre-built `GrokDevGannScanner.ex5` to `MQL5\Experts\` (or compile — see above)
2. Attach to **XAUUSD** **M5** or **M15** chart
3. **Algo Trading** ON
4. Output: `Common\Files\grok_dev_gann_scanner.json`

### Inputs

| Input | Default |
|-------|---------|
| `InpSymbol` | `XAUUSD` |
| `InpTf` | `M5` |
| `InpAtrPeriod` | `14` |
| `InpAtrThreshold` | `1.25` |
| `InpTimerSec` | `2` |

Used with Gann Intraday page and `run_gann_intraday.py`. See [docs/gann-intraday-pending-implementation.md](../../docs/gann-intraday-pending-implementation.md).

---

## Common Files layout

```
%APPDATA%\MetaQuotes\Terminal\Common\Files\
├── grok_dev_order_rsi_mt5.json    ← Order RSI EA
├── grok_dev_order_rsi_mt5.tmp     ← transient (atomic write)
├── grok_dev_order_rsi_log.txt       ← optional EA log
└── grok_dev_gann_scanner.json       ← Gann scanner EA
```

Override path for Python: `MT5_COMMON_FILES` env var.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| EA not in Navigator | Copy `.ex5` to `MQL5\Experts\`, Refresh |
| `mt5ExportAvailable` false | Algo Trading ON; check JSON exists and is &lt; 30s old |
| `INIT_FAILED` on attach | Symbol not in Market Watch — add XAUUSD |
| Partial JSON / parse errors | Use EA v2 atomic writes; Python retries once |
| Wrong RSI vs Data Window | RSI indicator **14 / Close** on chart; compare Bar 0 / Bar 1 |
| Compile errors | Open log in `python/mt5_scripts/*.log`; use MT5 build ≥ 5.x |

---

## Repo layout

```
python/mt5_scripts/
├── README.md                      ← this file
├── deploy-mt5-eas.ps1              ← copy both EAs to all MT5 Experts folders
├── GrokDevOrderRsiExport.mq5      ← source (v2.0)
├── GrokDevOrderRsiExport.ex5      ← pre-built (commit in repo)
├── GrokDevGannScanner.mq5         ← source (v1.0)
├── GrokDevGannScanner.ex5         ← pre-built (commit in repo)
└── *.log                          ← compile logs (gitignored)
```

After changing `.mq5`, recompile, commit updated `.ex5` if you ship pre-built binaries.
