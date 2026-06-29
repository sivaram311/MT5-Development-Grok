import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import {
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement
} from 'chartjs-chart-financial';
import { environment } from '../../environments/environment';
import { PageHeaderComponent } from '../ui/page-header.component';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { PullToRefreshComponent } from '../ui/pull-to-refresh.component';
import { SegmentControlComponent } from '../ui/segment-control.component';
import { NyLiquiditySweepStreamService, LiquiditySetup } from '../services/ny-liquidity-sweep-stream.service';
import { formatWallTime } from '../utils/time.util';

Chart.register(...registerables, CandlestickController, CandlestickElement, OhlcController, OhlcElement);

interface OhlcCandle {
  time?: string;
  nyTime?: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface LiquidityStats {
  totalSetups: number;
  wins: number;
  losses: number;
  openSetups: number;
  winRate: number;
  averageRr: number;
}

type ChartMode = 'candlestick' | 'line';

interface ChartPayload {
  candles: OhlcCandle[];
  levels: Record<string, number>;
  setup: LiquiditySetup | null;
  sweepTime?: string;
  structureTime?: string;
}

@Component({
  selector: 'app-ny-liquidity-sweep',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PageHeaderComponent, StatusBadgeComponent, EmptyStateComponent, PullToRefreshComponent, SegmentControlComponent],
  template: `
    <app-pull-to-refresh (refresh)="refresh()">
      <app-page-header
        title="NY Liquidity Analyzer"
        subtitle="Liquidity sweep → structure reference → multi-TF RSI confluence during New York session.">
        <div actions>
          <button type="button" (click)="runScan()" [disabled]="scanning"
            class="min-h-11 px-4 text-xs font-semibold rounded-2xl border border-emerald-800 text-emerald-400 active:bg-emerald-950 disabled:opacity-50">
            {{ scanning ? 'Scanning…' : 'Scan history' }}
          </button>
        </div>
        <div toolbar>
          <span *ngIf="streamConnected" class="text-[10px] px-2 py-1 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-800">LIVE SSE</span>
          <span *ngIf="liveSetup?.live" class="text-[10px] px-2 py-1 rounded-full bg-amber-900/50 text-amber-300 border border-amber-800 ml-2">Active setup</span>
        </div>
      </app-page-header>

      <!-- Stats -->
      <div class="grid grid-cols-2 tablet:grid-cols-5 gap-3 mb-6" *ngIf="stats">
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
          <div class="text-[10px] text-zinc-500 uppercase">Total</div>
          <div class="text-2xl font-semibold mt-1">{{ stats.totalSetups }}</div>
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
          <div class="text-[10px] text-zinc-500 uppercase">Win rate</div>
          <div class="text-2xl font-semibold mt-1 text-emerald-400">{{ stats.winRate }}%</div>
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
          <div class="text-[10px] text-zinc-500 uppercase">Avg R:R</div>
          <div class="text-2xl font-semibold mt-1">{{ stats.averageRr | number:'1.1-1' }}</div>
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
          <div class="text-[10px] text-zinc-500 uppercase">Wins</div>
          <div class="text-2xl font-semibold mt-1 text-emerald-400">{{ stats.wins }}</div>
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 col-span-2 tablet:col-span-1">
          <div class="text-[10px] text-zinc-500 uppercase">Losses</div>
          <div class="text-2xl font-semibold mt-1 text-red-400">{{ stats.losses }}</div>
        </div>
      </div>

      <!-- Live RSI panel -->
      <div *ngIf="liveSetup?.live" class="mb-6 bg-zinc-900 border border-emerald-800/50 rounded-3xl p-4">
        <div class="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Live setup · Multi-TF RSI</div>
        <div class="grid mobile:grid-cols-2 tablet:grid-cols-4 gap-3 text-sm">
          <div><span class="text-zinc-500 text-xs">Direction</span><div class="font-semibold">{{ liveSetup?.direction }}</div></div>
          <div><span class="text-zinc-500 text-xs">H1 RSI</span><div class="font-mono">{{ liveSetup?.rsi_htf ?? '—' }}</div></div>
          <div><span class="text-zinc-500 text-xs">M15 RSI</span><div class="font-mono">{{ liveSetup?.rsi_ltf ?? '—' }}</div></div>
          <div><span class="text-zinc-500 text-xs">How spotted</span><div class="text-xs">{{ liveSetup?.how_spotted }}</div></div>
        </div>
      </div>

      <!-- Chart -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="text-xs text-zinc-400 uppercase tracking-wider">
            {{ chartMode === 'candlestick' ? 'OHLC candlestick' : 'Close line' }} · M5
            <span *ngIf="selectedSetup"> · {{ selectedSetup.date }} {{ selectedSetup.ny_time }} NY</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <app-segment-control
              [options]="chartModeOptions"
              [value]="chartModeLabel"
              ariaLabel="Chart type"
              (valueChange)="setChartMode($event)">
            </app-segment-control>
            <app-status-badge *ngIf="selectedSetup" [label]="selectedSetup.direction" [tone]="selectedSetup.direction === 'Bullish' ? 'success' : 'warning'"></app-status-badge>
          </div>
        </div>
        <div *ngIf="chartLoading" class="h-64 flex items-center justify-center text-zinc-500 text-sm">Loading chart…</div>
        <div *ngIf="!chartLoading && !selectedSetup" class="h-48 flex items-center justify-center text-zinc-500 text-sm">Select a setup below to view chart with levels</div>
        <div class="relative h-80 sm:h-96" [class.hidden]="chartLoading || !selectedSetup">
          <canvas #chartCanvas class="w-full h-full"></canvas>
        </div>
        <div *ngIf="selectedSetup" class="mt-3 flex flex-wrap gap-3 text-[10px] font-mono">
          <span class="text-red-400">SL {{ selectedSetup.sl | number:'1.2-2' }}</span>
          <span class="text-amber-400">Sweep {{ selectedSetup.sweep_level | number:'1.2-2' }}</span>
          <span class="text-zinc-400">Struct {{ selectedSetup.structure_level | number:'1.2-2' }}</span>
          <span class="text-emerald-400">Entry {{ selectedSetup.entry | number:'1.2-2' }}</span>
          <span class="text-emerald-300">TP1 {{ selectedSetup.tp1 | number:'1.2-2' }}</span>
          <span class="text-emerald-200">TP2 {{ selectedSetup.tp2 | number:'1.2-2' }}</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-2 mb-4">
        <select [(ngModel)]="filterDirection" (change)="loadSetups()" class="min-h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs">
          <option value="">All directions</option>
          <option value="Bullish">Bullish</option>
          <option value="Bearish">Bearish</option>
        </select>
        <select [(ngModel)]="filterResult" (change)="loadSetups()" class="min-h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs">
          <option value="">All results</option>
          <option value="Win">Win</option>
          <option value="Loss">Loss</option>
          <option value="Open">Open</option>
        </select>
        <button type="button" (click)="exportCsv()" [disabled]="!setups.length"
          class="min-h-11 px-4 text-xs rounded-xl border border-zinc-700 active:bg-zinc-800 disabled:opacity-50 ml-auto">
          Export CSV
        </button>
      </div>

      <!-- Grid -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <app-empty-state *ngIf="loading" [loading]="true" loadingMessage="Loading historical setups…"></app-empty-state>
        <div *ngIf="!loading && setups.length" class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-zinc-950 text-zinc-500 uppercase tracking-wider">
              <tr>
                <th class="text-left p-3">Date</th>
                <th class="text-left p-3">NY</th>
                <th class="text-left p-3 hidden sm:table-cell">IST</th>
                <th class="text-left p-3">Dir</th>
                <th class="text-right p-3">Sweep</th>
                <th class="text-right p-3 hidden tablet:table-cell">Struct</th>
                <th class="text-right p-3">Entry</th>
                <th class="text-left p-3">Result</th>
                <th class="text-right p-3">R:R</th>
                <th class="text-left p-3 hidden lg:table-cell">How spotted</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of setups; trackBy: trackSetup"
                (click)="selectSetup(row)"
                class="border-t border-zinc-800 cursor-pointer active:bg-zinc-800/50"
                [class.bg-zinc-800]="selectedSetup?.setup_id === row.setup_id">
                <td class="p-3 font-mono">{{ row.date }}</td>
                <td class="p-3">{{ row.ny_time }}</td>
                <td class="p-3 hidden sm:table-cell">{{ row.ist_time }}</td>
                <td class="p-3">{{ row.direction }}</td>
                <td class="p-3 text-right font-mono">{{ row.sweep_level | number:'1.2-2' }}</td>
                <td class="p-3 text-right font-mono hidden tablet:table-cell">{{ row.structure_level | number:'1.2-2' }}</td>
                <td class="p-3 text-right font-mono">{{ row.entry | number:'1.2-2' }}</td>
                <td class="p-3">
                  <app-status-badge [label]="row.result || '—'" [tone]="resultTone(row.result)"></app-status-badge>
                </td>
                <td class="p-3 text-right font-mono">{{ row.rr_achieved != null ? (row.rr_achieved | number:'1.1-1') : '—' }}</td>
                <td class="p-3 text-zinc-500 hidden lg:table-cell max-w-[12rem] truncate">{{ row.how_spotted }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <app-empty-state *ngIf="!loading && !setups.length"
          message="No setups found. Run Scan history or python run_ny_liquidity_sweep.py --backfill"
          actionLabel="Scan now" (actionClick)="runScan()"></app-empty-state>
      </div>
    </app-pull-to-refresh>
  `
})
export class NyLiquiditySweepComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private chart?: Chart;
  private lastChartData: ChartPayload | null = null;

  setups: LiquiditySetup[] = [];
  selectedSetup: LiquiditySetup | null = null;
  liveSetup: LiquiditySetup | null = null;
  stats: LiquidityStats | null = null;
  loading = false;
  chartLoading = false;
  scanning = false;
  streamConnected = false;
  filterDirection = '';
  filterResult = '';
  chartMode: ChartMode = 'candlestick';
  chartModeOptions = ['Candles', 'Line'];

  get chartModeLabel(): string {
    return this.chartMode === 'line' ? 'Line' : 'Candles';
  }

  formatWallTime = formatWallTime;

  constructor(
    private http: HttpClient,
    private stream: NyLiquiditySweepStreamService
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('nyLiquidityChartMode');
    if (saved === 'line' || saved === 'candlestick') {
      this.chartMode = saved;
    }
    this.stream.connected$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(c => {
      this.streamConnected = c;
      this.cdr.markForCheck();
    });
    this.stream.snapshot$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(s => {
      if (s?.live) {
        this.liveSetup = s;
        this.cdr.markForCheck();
      }
    });
    this.refresh();
  }

  ngAfterViewInit(): void {
    // chart built on selectSetup
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  refresh(): void {
    this.loadStats();
    this.loadSetups();
    this.http.get<LiquiditySetup>(`${environment.apiUrl}/market/xauusd/ny-liquidity-sweep`).subscribe({
      next: data => {
        if (data?.live) {
          this.liveSetup = data;
        }
        this.cdr.markForCheck();
      }
    });
  }

  loadStats(): void {
    this.http.get<LiquidityStats>(`${environment.apiUrl}/market/xauusd/ny-liquidity-sweep/stats`).subscribe({
      next: s => {
        this.stats = s;
        this.cdr.markForCheck();
      }
    });
  }

  loadSetups(): void {
    this.loading = true;
    this.cdr.markForCheck();
    let params = new HttpParams().set('limit', '500');
    if (this.filterDirection) params = params.set('direction', this.filterDirection);
    if (this.filterResult) params = params.set('result', this.filterResult);
    this.http.get<LiquiditySetup[]>(`${environment.apiUrl}/market/xauusd/ny-liquidity-sweep/setups`, { params }).subscribe({
      next: rows => {
        this.setups = rows || [];
        this.loading = false;
        if (this.setups.length && !this.selectedSetup) {
          this.selectSetup(this.setups[0]);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.setups = [];
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  runScan(): void {
    this.scanning = true;
    this.cdr.markForCheck();
    this.http.post<{ detected: number }>(`${environment.apiUrl}/market/xauusd/ny-liquidity-sweep/scan?days=30`, {}).subscribe({
      next: () => {
        this.scanning = false;
        this.refresh();
      },
      error: () => {
        this.scanning = false;
        this.cdr.markForCheck();
      }
    });
  }

  setChartMode(value: string): void {
    this.chartMode = value === 'Line' ? 'line' : 'candlestick';
    localStorage.setItem('nyLiquidityChartMode', this.chartMode);
    if (this.lastChartData) {
      this.buildChart(this.lastChartData);
    }
    this.cdr.markForCheck();
  }

  selectSetup(row: LiquiditySetup): void {
    this.selectedSetup = row;
    this.chartLoading = true;
    this.cdr.markForCheck();
    this.http.get<any>(`${environment.apiUrl}/market/xauusd/ny-liquidity-sweep/chart/${encodeURIComponent(row.setup_id)}`).subscribe({
      next: data => {
        this.chartLoading = false;
        this.lastChartData = this.normalizeChartData(data);
        this.buildChart(this.lastChartData);
        this.cdr.markForCheck();
      },
      error: () => {
        this.chartLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  trackSetup(_i: number, row: LiquiditySetup): string {
    return row.setup_id;
  }

  resultTone(result: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (result === 'Win') return 'success';
    if (result === 'Loss') return 'danger';
    if (result === 'Open') return 'warning';
    return 'neutral';
  }

  exportCsv(): void {
    if (!this.setups.length) return;
    const headers = ['Date', 'NY', 'IST', 'Direction', 'Sweep', 'Structure', 'Entry', 'SL', 'TP1', 'TP2', 'Result', 'RR', 'How Spotted'];
    const lines = [
      headers.join(','),
      ...this.setups.map(r => [
        r.date, r.ny_time, r.ist_time, r.direction,
        r.sweep_level, r.structure_level, r.entry, r.sl, r.tp1, r.tp2,
        r.result, r.rr_achieved ?? '', `"${(r.how_spotted || '').replace(/"/g, '""')}"`
      ].join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ny_liquidity_setups.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private normalizeChartData(data: any): ChartPayload {
    const candles: OhlcCandle[] = (data?.candles || []).map((c: any) => ({
      time: c.time,
      nyTime: c.nyTime,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close)
    }));
    return {
      candles,
      levels: data?.levels || {},
      setup: data?.setup || this.selectedSetup,
      sweepTime: data?.sweepTime || data?.setup?.payload?.sweepTime,
      structureTime: data?.structureTime || data?.setup?.payload?.structureTime
    };
  }

  private buildChart(data: ChartPayload): void {
    if (!this.chartCanvas?.nativeElement) return;
    this.chart?.destroy();
    const { candles, levels, setup } = data;
    if (!candles.length) return;

    const labels = candles.map(c => {
      const t = c.nyTime || c.time || '';
      return t.length > 11 ? t.substring(11, 16) : t;
    });

    const datasets: ChartConfiguration['data']['datasets'] =
      this.chartMode === 'candlestick'
        ? [this.buildCandlestickDataset(candles)]
        : [this.buildCloseLineDataset(candles)];

    datasets.push(...this.buildLevelDatasets(candles, levels));
    datasets.push(...this.buildMarkerDatasets(candles, data, setup));

    const baseType = this.chartMode === 'candlestick' ? 'candlestick' : 'line';

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: baseType,
      data: { labels, datasets },
      options: this.buildChartOptions()
    });
  }

  private buildCandlestickDataset(candles: OhlcCandle[]) {
    return {
      type: 'candlestick' as const,
      label: 'XAUUSD M5',
      data: candles.map((c, i) => ({
        x: i,
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close
      })),
      borderColors: {
        up: '#34d399',
        down: '#f87171',
        unchanged: '#a1a1aa'
      },
      backgroundColors: {
        up: 'rgba(52, 211, 153, 0.85)',
        down: 'rgba(248, 113, 113, 0.85)',
        unchanged: 'rgba(161, 161, 170, 0.85)'
      }
    };
  }

  private buildCloseLineDataset(candles: OhlcCandle[]) {
    return {
      type: 'line' as const,
      label: 'Close',
      data: candles.map(c => c.close),
      borderColor: '#34d399',
      backgroundColor: 'rgba(52, 211, 153, 0.1)',
      pointRadius: 0,
      borderWidth: 1.5,
      tension: 0.1,
      fill: false
    };
  }

  private buildLevelDatasets(candles: OhlcCandle[], levels: Record<string, number>) {
    const levelColors: Record<string, string> = {
      sweep: '#fbbf24',
      structure: '#a1a1aa',
      entry: '#34d399',
      sl: '#f87171',
      tp1: '#6ee7b7',
      tp2: '#a7f3d0'
    };
    const out: ChartConfiguration['data']['datasets'] = [];
    for (const [key, color] of Object.entries(levelColors)) {
      const val = levels[key];
      if (val != null) {
        out.push({
          type: 'line',
          label: key.toUpperCase(),
          data: candles.map(() => val),
          borderColor: color,
          borderDash: key === 'sl' || key.startsWith('tp') ? [6, 4] : [],
          pointRadius: 0,
          borderWidth: 1,
          fill: false
        });
      }
    }
    return out;
  }

  private buildMarkerDatasets(
    candles: OhlcCandle[],
    data: ChartPayload,
    setup: LiquiditySetup | null
  ) {
    const out: ChartConfiguration['data']['datasets'] = [];
    const sweepIdx = this.findMarkerIndex(candles, data.sweepTime);
    const structIdx = this.findMarkerIndex(candles, data.structureTime);
    if (sweepIdx >= 0) {
      out.push({
        type: 'scatter',
        label: 'Sweep',
        data: [{ x: sweepIdx, y: setup?.sweep_level ?? candles[sweepIdx].low }],
        pointRadius: 7,
        pointStyle: 'triangle',
        pointBackgroundColor: '#fbbf24',
        pointBorderColor: '#fbbf24',
        borderWidth: 0
      });
    }
    if (structIdx >= 0) {
      out.push({
        type: 'scatter',
        label: 'Structure',
        data: [{ x: structIdx, y: setup?.structure_level ?? candles[structIdx].close }],
        pointRadius: 6,
        pointStyle: 'circle',
        pointBackgroundColor: '#e4e4e7',
        pointBorderColor: '#e4e4e7',
        borderWidth: 0
      });
    }
    return out;
  }

  private buildChartOptions(): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, labels: { color: '#a1a1aa', boxWidth: 12, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const raw = ctx.raw;
              if (typeof raw === 'number') {
                return `${ctx.dataset.label}: ${raw.toFixed(2)}`;
              }
              const point = raw as { o?: number; h?: number; l?: number; c?: number; y?: number };
              if (point?.o != null && point?.h != null) {
                return `O ${point.o.toFixed(2)} H ${point.h.toFixed(2)} L ${point.l!.toFixed(2)} C ${point.c!.toFixed(2)}`;
              }
              if (point?.y != null) {
                return `${ctx.dataset.label}: ${point.y.toFixed(2)}`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          type: 'category',
          ticks: { color: '#71717a', maxTicksLimit: 14, font: { size: 9 } },
          grid: { color: '#27272a' }
        },
        y: {
          ticks: { color: '#71717a', font: { size: 9 } },
          grid: { color: '#27272a' }
        }
      }
    };
  }

  private findMarkerIndex(candles: OhlcCandle[], time?: string): number {
    if (!time || !candles.length) return -1;
    const target = time.substring(0, 16);
    const idx = candles.findIndex(c => (c.time || '').substring(0, 16) === target);
    if (idx >= 0) return idx;
    return candles.findIndex(c => (c.time || '').startsWith(target.substring(0, 10)));
  }
}
