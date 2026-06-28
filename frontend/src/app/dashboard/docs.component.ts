import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../ui/page-header.component';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <div class="max-w-4xl mx-auto">
      <app-page-header
        title="Technical Documentation"
        subtitle="Deep explanation of the Grok Dev stack — optimized for phones and tablets. Tap a section to expand.">
      </app-page-header>

      <div class="mb-4 p-3 bg-zinc-900 border border-zinc-700 rounded-2xl text-xs leading-relaxed">
        <strong>Mobile tip:</strong> Use quick nav chips below. Sections use accordions with safe scroll offsets for the sticky header.
      </div>

      <!-- Quick Navigation -->
      <div class="mb-6 flex flex-wrap gap-2 text-xs">
        <a href="#overview" class="min-h-9 inline-flex items-center px-3 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">1. Overview</a>
        <a href="#layers" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">2. Three Layers</a>
        <a href="#database" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">3. Database</a>
        <a href="#python" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">4. Python</a>
        <a href="#spring" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">5. Spring Boot</a>
        <a href="#angular" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">6. Angular</a>
        <a href="#ny" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">7. NY Session</a>
        <a href="#time" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">8. Timezones</a>
        <a href="#auth" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">9. Auth &amp; JWT</a>
        <a href="#health" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">10. Health</a>
        <a href="#order-rsi" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">Analyzer</a>
        <a href="#gann-intraday" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">Gann Intraday</a>
        <a href="#flow" class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 active:bg-zinc-700">11. Full Data Flow</a>
      </div>

      <!-- Sections as mobile-friendly accordions -->
      <div class="space-y-3">

        <!-- Overview -->
        <details id="overview" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden" open>
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">1. Project Overview &amp; Core Logic</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 space-y-4 leading-relaxed">
            <p>This is a full-stack trading data platform for <strong>XAUUSD (Gold)</strong> built for real traders on mobile and tablet devices (Realme P2 Pro / Pad 2 priority).</p>
            
            <div>
              <div class="font-medium text-emerald-400 mb-1">What it actually does:</div>
              <ul class="list-disc pl-5 space-y-1 text-xs">
                <li>Pulls live + historical OHLC from MetaTrader 5 terminal</li>
                <li>Stores it cleanly in Postgres database</li>
                <li>Exposes powerful APIs (including "NY Session Only" computed D1 daily bars)</li>
                <li>Shows beautiful, accurate data grid with Broker / NY / IST times side-by-side</li>
                <li>Computes RSI(14) Wilder strictly on the exact timeframe series you are viewing</li>
                <li>Monitors data freshness and downloader heartbeat in real time</li>
              </ul>
            </div>

            <p>The key innovation is the <strong>NY Session Only</strong> toggle on the Market Data grid. When enabled for D1, the system does <em>not</em> use the stored daily bars. Instead it reconstructs each "daily" bar using only the 9-hour New York session from underlying M15 data. RSI is then recomputed purely on that filtered series.</p>

            <p class="text-xs bg-zinc-950 p-2 rounded">Example from your data: When NY is on, a row might show Broker 12:00 → NY 08:00 → IST 17:30 (exactly 5:30 PM IST for NY open in summer). This is 100% intentional and correct.</p>
          </div>
        </details>

        <!-- Architecture -->
        <details id="layers" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">2. The Three Layers — How They Work Together</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 space-y-4">
            <div class="bg-zinc-950 p-3 rounded-2xl text-xs font-mono">
              MT5 Terminal<br>
              ↓ (copy_rates_from_pos / copy_rates_from)<br>
              Python Downloader (only completed candles, incremental updates)<br>
              ↓ (ON CONFLICT DO NOTHING on time PK)<br>
              PostgreSQL (grok_dev schema)<br>
              ↓<br>
              Spring Boot (JdbcTemplate for dynamic names + business logic)<br>
              ↓ (enriched JSON with nyTime, istTime, RSI calculation)<br>
              Angular (HttpClient, safe wall-time display, responsive UI)
            </div>

            <p><strong>Why this separation?</strong> MT5 Python bindings only exist in Windows/Python. Heavy calculations (D1 NY aggregation, RSI on filtered series, proper timezone conversion using broker offset + DST rules) belong in the backend. Angular stays thin and focused on excellent UX, especially on small screens.</p>

            <p>Postgres is the <strong>single source of truth</strong>. Nothing is cached in memory between the layers for market data.</p>
          </div>
        </details>

        <!-- Database -->
        <details id="database" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">3. Database Schema — Full Details</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 space-y-4">
            <p>All market data lives in schema <code>grok_dev</code>.</p>

            <div>
              <div class="font-medium">XAUUSD_* tables (D1, H4, H1, M15, M5, M1)</div>
              <div class="text-xs mt-1 bg-zinc-950 p-2 rounded font-mono">
                time TIMESTAMP PRIMARY KEY<br>
                open NUMERIC(12,5)<br>
                high NUMERIC(12,5)<br>
                low NUMERIC(12,5)<br>
                close NUMERIC(12,5)<br>
                tick_volume BIGINT<br>
                spread INTEGER<br>
                real_volume BIGINT
              </div>
              <p class="text-xs mt-1">The <code>time</code> column is the broker server wall-clock time (naive timestamp). This is critical for later conversion.</p>
            </div>

            <div>
              <div class="font-medium">sync_status</div>
              <div class="text-xs mt-1 bg-zinc-950 p-2 rounded font-mono">
                timeframe VARCHAR PRIMARY KEY (D1, H4, H1, M15, M5, M1)<br>
                last_candle_time TIMESTAMP<br>
                last_synced TIMESTAMP
              </div>
              <p class="text-xs mt-1">Used by Python and exposed in Health dashboard. Contains last_candle_time and last_synced per timeframe.</p>
            </div>

            <p class="text-xs">Python creates tables on first run using SQLAlchemy with <code>extend_existing=True</code>. Spring Boot uses <code>ddl-auto=update</code>.</p>
          </div>
        </details>

        <!-- Python -->
        <details id="python" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">4. Python MT5 Downloader — Complete Logic</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 space-y-3 text-xs leading-relaxed">
            <p>The Python pipeline code is organized in <a href="file:///E:/Source/grok_dev/python/mt5_xauusd/" target="_blank" class="text-emerald-400 underline">mt5_xauusd</a>:</p>
            <ul class="pl-4 list-disc space-y-1">
              <li><strong><a href="file:///E:/Source/grok_dev/python/mt5_xauusd/mt5_client.py" target="_blank" class="text-emerald-400 underline">mt5_client.py</a></strong> handles low-level MT5 wrapper calls. Uses <code>copy_rates_from_pos</code> and <code>copy_rates_from</code>, always dropping the active forming bar (<code>df.iloc[:-1]</code>) so incomplete data is never saved.</li>
              <li><strong><a href="file:///E:/Source/grok_dev/python/mt5_xauusd/postgres_client.py" target="_blank" class="text-emerald-400 underline">postgres_client.py</a></strong> defines dynamic tables and performs <code>insert().on_conflict_do_nothing()</code> on the <code>time</code> column index.</li>
              <li><strong><a href="file:///E:/Source/grok_dev/python/mt5_xauusd/data_downloader.py" target="_blank" class="text-emerald-400 underline">data_downloader.py</a></strong> orchestrates incremental sync and continuous daemon polling using smart per-timeframe intervals (M1 every 15s, D1 every 30min).</li>
            </ul>
            <p class="bg-zinc-950 p-2 rounded mt-2">Key rule: "Only completed candles. Never store a bar that can still change."</p>
          </div>
        </details>

        <!-- Spring Boot -->
        <details id="spring" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">5. Spring Boot Backend — Deep Logic</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 space-y-3 text-xs">
            <p><strong><a href="file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java" target="_blank" class="text-emerald-400 underline">MarketDataService.java</a></strong> is the central processor.</p>

            <div class="pl-3 border-l border-zinc-700">
              <div>1. Fetch candles from database using <code>JdbcTemplate</code> to handle dynamic table names based on timeframe.</div>
              <div>2. Reverse list to chronological (ascending) order.</div>
              <div>3. <strong>If nySessionOnly and D1:</strong></div>
              <div class="pl-4">- Query historical M15 data (using a deep fetch depth).</div>
              <div class="pl-4">- Keep only bars where the NY hour is in the 8:00 AM - 4:45 PM window (hour >= 8 && hour &lt; 17).</div>
              <div class="pl-4">- Aggregate to synthetic daily candles (open = first open, high = max, low = min, close = last, volume = sum).</div>
              <div class="pl-3">4. Calculate RSI(14) Wilder on the resulting series.</div>
              <div class="pl-3">5. Trim list to requested limit and return in descending order.</div>
            </div>

            <p><strong>Wilder's RSI Smoothing Formula:</strong></p>
            <div class="bg-zinc-950 p-2 text-[10px] font-mono">
              gains[i] = max(change, 0), losses[i] = max(-change, 0)<br>
              Initial avg = sum over first 14 periods / 14<br>
              Smooth: avgGain = ((avgGain * 13) + currentGain) / 14<br>
              rs = avgGain / avgLoss, rsi = 100 - (100 / (1 + rs))
            </div>

            <p><strong>User Preferences APIs:</strong></p>
            <p>Exposed in <strong><a href="file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/AuthController.java" target="_blank" class="text-emerald-400 underline">AuthController.java</a></strong> via <code>/api/auth/preferences</code> (GET, PUT, PATCH). The Angular app uses <strong>PATCH</strong> with partial JSON so grid, market, and volatility sections do not overwrite each other.</p>
          </div>
        </details>

        <!-- Angular -->
        <details id="angular" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">6. Angular Frontend — Detailed Architecture</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 text-xs space-y-3">
            <p><strong>Routing &amp; Shell:</strong> Child routes are lazy-loaded within the <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/dashboard-layout.component.ts" target="_blank" class="text-emerald-400 underline">DashboardLayoutComponent</a> shell, preserving screen area and performance:</p>
            <ul class="pl-4 list-disc space-y-1">
              <li><strong>Overview:</strong> <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/overview.component.ts" target="_blank" class="text-emerald-400 underline">overview.component.ts</a> - displays summary metrics (currently static demo data).</li>
              <li><strong>Market Data:</strong> <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts" target="_blank" class="text-emerald-400 underline">market.component.ts</a> - core data grid displaying live backend values, NY toggle, and slide-over column customizer.</li>
              <li><strong>Volatility:</strong> <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/volatility.component.ts" target="_blank" class="text-emerald-400 underline">volatility.component.ts</a> - Volatility Explorer analyzing High-to-Low price ranges over custom candle counts.</li>
              <li><strong>Health:</strong> <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/health.component.ts" target="_blank" class="text-emerald-400 underline">health.component.ts</a> - displays live freshness cards from backend.</li>
              <li><strong>Analysis:</strong> <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/analysis.component.ts" target="_blank" class="text-emerald-400 underline">analysis.component.ts</a> — RSI storm scanner and Gann level studies (octave + Square-of-9).</li>
              <li><strong>Analyzer:</strong> <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/order-rsi.component.ts" target="_blank" class="text-emerald-400 underline">order-rsi.component.ts</a> — live multi-TF RSI table (route <code>order-rsi</code>).</li>
              <li><strong>Docs:</strong> <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/docs.component.ts" target="_blank" class="text-emerald-400 underline">docs.component.ts</a> - this technical doc viewer.</li>
            </ul>

            <p><strong>Column Customizer &amp; User Preference Features</strong> in <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts" target="_blank" class="text-emerald-400 underline">market.component.ts</a> via <a href="file:///E:/Source/grok_dev/frontend/src/app/services/preferences.service.ts" target="_blank" class="text-emerald-400 underline">preferences.service.ts</a>:</p>
            <ul class="pl-4 list-disc space-y-1">
              <li><strong>HTML5 Drag-and-Drop:</strong> Reorder columns in the bottom sheet; ↑↓ buttons for touch.</li>
              <li><strong>Mobile Presets:</strong> Quick chips (All, Core + Times, RSI, Minimal).</li>
              <li><strong>Copy to Clipboard:</strong> TSV export of visible columns and rows.</li>
              <li><strong>Preference Sync:</strong> GET on load; PATCH partial sections on save (deep merge on server).</li>
            </ul>

            <p><strong>Health push alerts:</strong> Dashboard shell subscribes to <code>/api/market/xauusd/health/stream</code> (SSE). Shows a banner when pipeline status becomes DEGRADED or DOWN.</p>

            <p><strong>PWA manifest:</strong> <code>src/assets/manifest.webmanifest</code> — linked as <code>assets/manifest.webmanifest</code> in index.html (fixes dev-server 404).</p>

            <p><strong>Time Parsing:</strong> Utilizes <code>formatWallTime()</code> in <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts" target="_blank" class="text-emerald-400 underline">market.component.ts</a> to parse naive ISO strings. This bypasses browser local timezone conversions which shift display hours based on the client's location.</p>
          </div>
        </details>

        <!-- Analyzer (order-rsi route) -->
        <details id="order-rsi" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">Analyzer — Live Multi-Timeframe RSI</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 text-xs space-y-3">
            <p>Bottom nav <strong>Analyzer</strong> (<code>/dashboard/order-rsi</code>) shows RSI(14) on close for <strong>W1 → M1</strong>.</p>

            <p><strong>Layout:</strong> Table with timeframes as <strong>column headers</strong> (W1 → M1). Rows: Bar 0/1 RSI + data; <strong>B0SR</strong> / <strong>B1SR</strong> classic pivot levels (S3–R3).</p>

            <p><strong>Show rows</strong> chips: Bar 0/1 RSI and data individually; <strong>B0SR</strong> and <strong>B1SR</strong> each toggle all seven S/R levels together.</p>

            <p><strong>Classic S/R</strong> — floor pivots from each bar's H/L/C. B0SR / B1SR chips toggle S/R rows.</p>

            <p><strong>Gann Odd Square</strong> — two tables: Bar 1 Close / Bar 0 Open. Pivot centered; odd+even merged above/below by distance from pivot (one row per level). Separate toggles per grid.</p>

            <p><strong>Zone highlights</strong> (rectangle background, not text color):</p>
            <ul class="pl-4 list-disc space-y-1">
              <li>Red: RSI &lt; 40</li>
              <li>Yellow: 40–44 or 56–60</li>
              <li>Neutral: 45–55</li>
              <li>Green: RSI &gt; 60</li>
            </ul>

            <p><strong>RSI source toggle</strong> (page only, not saved):</p>
            <ul class="pl-4 list-disc space-y-1">
              <li><strong>Calculated</strong> — Python Wilder from <code>run_order_rsi.py</code></li>
              <li><strong>MT5 built-in</strong> — values from <code>GrokDevOrderRsiExport.mq5</code> EA (attach on XAUUSD, Algo Trading ON)</li>
            </ul>

            <p><strong>Data flow:</strong></p>
            <div class="bg-zinc-950 p-3 rounded-2xl font-mono text-[11px] leading-relaxed">
              MT5 terminal<br>
              ↓ python run_order_rsi.py (tick mode)<br>
              grok_dev.live_order_rsi (JSON snapshot)<br>
              ↓ GET /api/market/xauusd/order-rsi/stream (SSE)<br>
              <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/order-rsi.component.ts" target="_blank" class="text-emerald-400 underline">order-rsi.component.ts</a>
            </div>

            <p>Compare with MT5 Data Window: Bar 0 = forming candle, Bar 1 = previous closed candle. RSI indicator must be <strong>14 / Close</strong>.</p>

            <p>Full guide: <a href="file:///E:/Source/grok_dev/docs/order-rsi-mt5-alignment.md" target="_blank" class="text-emerald-400 underline">docs/order-rsi-mt5-alignment.md</a></p>
          </div>
        </details>

        <!-- Gann Intraday -->
        <details id="gann-intraday" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">Gann Intraday — Usage Guide</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 text-xs space-y-3 leading-relaxed">
            <p><strong>Route:</strong> <code>/dashboard/gann-intraday</code> — sidebar <strong>Gann Intraday</strong> or phone <strong>More</strong> menu. Intraday mean-reversion &amp; reversal study for <strong>XAUUSD</strong>.</p>
            <p>Full tutorial (markdown): <a href="file:///E:/Source/grok_dev/frontend/docs/GANN_INTRADAY_USAGE_GUIDE.md" target="_blank" class="text-emerald-400 underline">frontend/docs/GANN_INTRADAY_USAGE_GUIDE.md</a></p>

            <p><strong>Before you start</strong></p>
            <ul class="pl-4 list-disc space-y-1">
              <li>Log in; backend + M5/M15/D1 grids with <code>nyTime</code> on M15</li>
              <li>Optional: <code>python run_gann_intraday.py</code> for <strong>LIVE</strong> badge</li>
              <li>Pull-to-refresh or tap <strong>Refresh</strong> after changing controls</li>
            </ul>

            <p><strong>Header controls</strong></p>
            <ul class="pl-4 list-disc space-y-1">
              <li><strong>Entry TF</strong> (M5/M15) — current price, ATR, candle filters</li>
              <li><strong>So9 pivot</strong> — NY open (default), London open, PDH/PDL, session H/L</li>
              <li><strong>Time scale</strong> (0.5–2.0) — time squaring sensitivity</li>
              <li><strong>ATR alert</strong> (0.75–2.5×) — 1×1 stretch threshold</li>
              <li><strong>Status:</strong> LIVE (SSE) · GRID (REST/computed) · OFFLINE DATA (cache)</li>
            </ul>

            <p><strong>Page sections (top → bottom)</strong></p>
            <ol class="pl-4 list-decimal space-y-1">
              <li><strong>Reversal confluence</strong> — HIGH / MEDIUM / LOW score + reason bullets</li>
              <li><strong>Session cards</strong> — PDH, PDL, NY/London open, active killzones</li>
              <li><strong>1×1 angle</strong> — equilibrium, deviation, bias, fan table (1×1/2×1/1×2)</li>
              <li><strong>Square of Nine</strong> — fine steps (teal) + Odd/Even toggles; emerald = near price</li>
              <li><strong>Time squaring</strong> — 45/90/180 min vs price move; NEAR SQUARE flag</li>
              <li><strong>Killzones</strong> — London Open, NY Open, Overlap, Afternoon (NY + IST)</li>
              <li><strong>Filters</strong> — volume spike, RSI divergence</li>
            </ol>

            <p><strong>Confluence scoring</strong> (reversal banner)</p>
            <div class="bg-zinc-950 p-3 rounded-2xl text-[11px] font-mono leading-relaxed">
              1×1 alert/overextension +2 · So9 level +1 · time square +1 · killzone +1<br>
              reversal candle +1 · volume spike +1 · RSI div +1<br>
              ≥5 HIGH · ≥3 MEDIUM · ≥1 LOW
            </div>

            <p><strong>Tutorial — NY open fade</strong></p>
            <ol class="pl-4 list-decimal space-y-1">
              <li>Trade during <strong>NY Open</strong> killzone (ACTIVE badge)</li>
              <li>Wait for <strong>Overextended ↑</strong> on 1×1 with So9 level highlighted</li>
              <li>Banner <strong>MEDIUM</strong> or <strong>HIGH</strong> → fade toward <strong>Equilibrium</strong></li>
            </ol>

            <p><strong>Dashboard banner</strong> — red/amber <em>Gann reversal</em> on other pages when severity is high/medium; tap <strong>Open Gann Intraday</strong>.</p>

            <p><strong>Data flow:</strong></p>
            <div class="bg-zinc-950 p-3 rounded-2xl font-mono text-[11px] leading-relaxed">
              GET /api/market/xauusd/gann-intraday (your controls)<br>
              ↓ fallback: M5 · M15 · D1 /grid → gann-intraday.util.ts<br>
              SSE /gann-intraday/stream → LIVE badge + dashboard alerts
            </div>

            <p>Tracker: <a href="file:///E:/Source/grok_dev/docs/gann-intraday-pending-implementation.md" target="_blank" class="text-emerald-400 underline">gann-intraday-pending-implementation.md</a> · API: <a href="file:///E:/Source/grok_dev/docs/api-endpoints.md" target="_blank" class="text-emerald-400 underline">api-endpoints.md</a></p>
          </div>
        </details>

        <!-- NY Session -->
        <details id="ny" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">7. NY Session Only — Step by Step with Your Data</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 text-xs space-y-3">
            <p>When you tick "NY Session Only" on D1:</p>
            <ol class="pl-4 list-decimal space-y-1">
              <li>Backend ignores the D1 table completely</li>
              <li>Fetches recent M15 (enough for ~hundreds of days)</li>
              <li>Enriches every M15 with nyTime using the configured broker zone</li>
              <li>Keeps only rows where nyTime.hour is 8–16</li>
              <li>Groups by NY date</li>
              <li>For each group builds one synthetic bar as described above</li>
              <li>Re-enriches the synthetic bar (so you see 08:00 NY / 17:30 IST)</li>
              <li>Runs full RSI on the list of these synthetic closes</li>
            </ol>

            <p>Your Jun 19 00:00 row (non-NY) has ny 20:00 previous day. That bar would be filtered out in NY mode because 20:00 is outside the session.</p>

            <p class="text-emerald-400">This is why row count and values change dramatically when you toggle.</p>
          </div>
        </details>

        <!-- Timezones -->
        <details id="time" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">8. Timezone Handling — Why IST 17:30 for NY 08:00</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 text-xs space-y-2">
            <p>Stored: broker wall time (example 12:00 on Jun 18)</p>
            <p>With broker-server-zone=UTC:</p>
            <p>→ 12:00 UTC = 08:00 America/New_York (EDT -4h)</p>
            <p>→ 12:00 UTC = 17:30 Asia/Kolkata (+5:30h)</p>

            <p>If your broker actually stamps the same instant as 15:00 (GMT+3), you must set <code>grok.market.broker-server-zone=GMT+3</code>. Then the math becomes correct again.</p>

            <p>The recent fix made the base zone configurable instead of hard-coded UTC. This directly solved the "Indian time shows wrong" issue you reported.</p>
          </div>
        </details>

        <!-- Auth -->
        <details id="auth" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">9. Authentication &amp; JWT Flow (Deep)</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 text-xs">
            <p><strong>Backend:</strong> BCrypt on every start via DataSeeder. Access token ~24h, refresh ~7 days (stored server side).</p>
            <p><strong>Angular AuthService + Interceptor:</strong></p>
            <ul class="pl-4">
              <li>Stores access + refresh in localStorage</li>
              <li>Proactive: if token expires in &lt;5min, refresh before sending request</li>
              <li>Reactive: on 401, try refresh once, then retry original request</li>
              <li>Uses BehaviorSubject to queue requests during refresh</li>
            </ul>
            <p class="mt-2">Guard protects the whole dashboard layout.</p>
          </div>
        </details>

        <!-- Health -->
        <details id="health" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">10. Health &amp; Freshness System</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 text-xs">
            <p>Backend computes real age in minutes and compares against thresholds: D1 &lt; 25h, H4 &lt; 4.5h, H1 &lt; 70min, M15 &lt; 20min, etc.</p>
            <p class="mt-2">Status = UP (all fresh), DEGRADED (some fresh), DOWN.</p>
            <p>This is exactly why on 23 Jun you saw Jun 19 as the newest row — the last_candle_time for D1 was still Jun 19.</p>
          </div>
        </details>

        <!-- Flow -->
        <details id="flow" class="doc-section bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <summary class="px-4 py-3.5 font-semibold cursor-pointer flex justify-between items-center active:bg-zinc-800 text-base">11. Full Data Flow &amp; Integration</summary>
          <div class="px-4 pb-5 text-sm text-zinc-300 text-xs space-y-3">
            <p>Here is how the entire integration lifecycle works for a single candle:</p>
            <ol class="pl-4 list-decimal space-y-1">
              <li><strong>MT5 Terminal:</strong> Price action feeds into the running terminal. The Python sync daemon <a href="file:///E:/Source/grok_dev/python/run_data_downloader.py" target="_blank" class="text-emerald-400 underline">run_data_downloader.py</a> pulls the rates via the official wrapper <a href="file:///E:/Source/grok_dev/python/mt5_xauusd/mt5_client.py" target="_blank" class="text-emerald-400 underline">mt5_client.py</a>.</li>
              <li><strong>Filtering &amp; Ingestion:</strong> The daemon filters for completed bars to prevent database revisions, and writes them cleanly using SQLAlchemy in <a href="file:///E:/Source/grok_dev/python/mt5_xauusd/postgres_client.py" target="_blank" class="text-emerald-400 underline">postgres_client.py</a>, updating the <code>sync_status</code> table.</li>
              <li><strong>Postgres Storage:</strong> Completed rates are stored as naive timestamps in <code>XAUUSD_*</code> tables in the <code>grok_dev</code> schema.</li>
              <li><strong>API Request:</strong> The Angular frontend grid <a href="file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts" target="_blank" class="text-emerald-400 underline">market.component.ts</a> invokes the backend endpoints exposed in <a href="file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/MarketDataController.java" target="_blank" class="text-emerald-400 underline">MarketDataController.java</a>.</li>
              <li><strong>Java Business Logic:</strong> The backend <a href="file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java" target="_blank" class="text-emerald-400 underline">MarketDataService.java</a> fetches raw candles, enriches them with IST and NY localized timestamps using the configurable broker server zone, computes synthetic NY session Daily OHLC where toggled, and calculates RSI Wilder on the exact output sequence.</li>
              <li><strong>Safe Client Display:</strong> The Angular grid parses localized timestamps with <code>formatWallTime()</code> to prevent native browser engine offset shifts, showing correct aligned hours to the trader.</li>
            </ol>
          </div>
        </details>

      </div>

      <div class="mt-6 text-center text-[10px] text-zinc-500">
        These sections are condensed from the full files in <code>frontend/docs/</code>.<br>
        For maximum detail open the .md files directly or ask for a specific section to be expanded even further.
      </div>
    </div>
  `
})
export class DocsComponent {}
