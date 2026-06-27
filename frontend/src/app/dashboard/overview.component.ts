import { Component, OnDestroy, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { environment } from '../../environments/environment';
import { PageHeaderComponent } from '../ui/page-header.component';
import { CandleCardComponent } from '../ui/candle-card.component';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { PullToRefreshComponent } from '../ui/pull-to-refresh.component';
import { SegmentControlComponent } from '../ui/segment-control.component';
import { TimeframeContextService } from '../services/timeframe-context.service';
import { MarketDataCacheService } from '../services/market-data-cache.service';
import { formatWallTime } from '../utils/time.util';

Chart.register(...registerables);

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    CandleCardComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    PullToRefreshComponent,
    SegmentControlComponent
  ],
  template: `
    <app-pull-to-refresh #ptr (refresh)="onPullRefresh()">
      <app-page-header
        title="Home"
        subtitle="Latest XAUUSD snapshot, price chart, and pipeline status.">
        <div toolbar>
          <app-segment-control
            [options]="timeframes"
            [value]="activeTimeframe"
            ariaLabel="Global timeframe"
            (valueChange)="onTimeframeChange($event)">
          </app-segment-control>
        </div>
      </app-page-header>

      <div *ngIf="usingCachedData" class="mb-4 text-xs px-3 py-2 rounded-2xl bg-amber-950/50 border border-amber-800 text-amber-200" role="status">
        Showing cached data — connect to backend for live updates.
      </div>

      <div class="grid grid-cols-2 tablet:grid-cols-4 gap-3 mb-6">
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 col-span-2 tablet:col-span-1">
          <div class="text-[10px] uppercase tracking-wider text-zinc-500">Latest close</div>
          <div class="text-2xl sm:text-3xl font-semibold tabular-nums mt-1 tracking-tight"
            [class.text-emerald-400]="priceChange != null && priceChange >= 0"
            [class.text-red-400]="priceChange != null && priceChange < 0">
            {{ latestCandle?.close != null ? (latestCandle.close | number:'1.2-2') : '—' }}
          </div>
          <div class="text-xs mt-1" [class.text-emerald-400]="priceChange != null && priceChange >= 0" [class.text-red-400]="priceChange != null && priceChange < 0">
            <span *ngIf="priceChange != null">{{ priceChange >= 0 ? '+' : '' }}{{ priceChange | number:'1.2-2' }}%</span>
            <span *ngIf="priceChange == null" class="text-zinc-500">—</span>
          </div>
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
          <div class="text-[10px] uppercase tracking-wider text-zinc-500">Timeframe</div>
          <div class="text-xl font-semibold mt-1">{{ activeTimeframe }}</div>
          <div class="text-xs text-zinc-500">{{ candles.length }} candles</div>
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
          <div class="text-[10px] uppercase tracking-wider text-zinc-500">Pipeline</div>
          <div class="mt-2">
            <app-status-badge *ngIf="healthStatus" [label]="healthStatus" [tone]="healthTone"></app-status-badge>
            <span *ngIf="!healthStatus" class="text-zinc-500 text-sm">—</span>
          </div>
          <div class="text-xs text-zinc-500 mt-1">{{ freshLabel }}</div>
        </div>
      </div>

      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 mb-6" *ngIf="candles.length">
        <div class="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Close price · {{ activeTimeframe }}</div>
        <div class="h-44 sm:h-52">
          <canvas #priceChart aria-label="Close price chart"></canvas>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mb-6">
        <a [routerLink]="['../market']" class="min-h-11 px-4 text-xs font-semibold rounded-2xl border border-zinc-700 active:bg-zinc-900 inline-flex items-center">Open Market</a>
        <a [routerLink]="['../health']" class="min-h-11 px-4 text-xs font-semibold rounded-2xl border border-zinc-700 active:bg-zinc-900 inline-flex items-center">Check Health</a>
        <a [routerLink]="['../volatility']" class="min-h-11 px-4 text-xs font-semibold rounded-2xl border border-zinc-700 active:bg-zinc-900 inline-flex items-center">Volatility</a>
      </div>

      <div class="mb-3 flex items-center justify-between px-1">
        <div class="font-semibold">Recent candles</div>
        <div class="text-xs text-zinc-500">{{ activeTimeframe }} · newest first</div>
      </div>

      <div class="hidden tablet:block bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden" *ngIf="!isLoading && candles.length">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                <th class="text-left py-3 px-5 font-medium">Broker</th>
                <th class="text-right py-3 px-4 font-medium">Open</th>
                <th class="text-right py-3 px-4 font-medium">High</th>
                <th class="text-right py-3 px-4 font-medium">Low</th>
                <th class="text-right py-3 px-4 font-medium">Close</th>
                <th class="text-right py-3 px-5 font-medium">Vol</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of candles" class="border-b border-zinc-800 last:border-none active:bg-zinc-800/50">
                <td class="px-5 py-3 font-mono text-xs text-zinc-400">{{ formatWallTime(row.time) }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs">{{ row.open | number:'1.2-2' }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs text-emerald-400">{{ row.high | number:'1.2-2' }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs text-red-400">{{ row.low | number:'1.2-2' }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs font-medium">{{ row.close | number:'1.2-2' }}</td>
                <td class="px-5 py-3 text-right font-mono text-xs text-zinc-400">{{ (row.tickVolume / 1000) | number:'1.0-0' }}k</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="tablet:hidden space-y-2" *ngIf="!isLoading && candles.length">
        <app-candle-card *ngFor="let row of candles.slice(0, 8)" [row]="row"></app-candle-card>
      </div>

      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden" *ngIf="isLoading || !candles.length">
        <app-empty-state [loading]="isLoading" loadingMessage="Loading overview…"
          message="No candle data yet. Start the Python MT5 downloader and refresh."
          actionLabel="Retry" (actionClick)="loadAll()"></app-empty-state>
      </div>
    </app-pull-to-refresh>
  `
})
export class OverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('ptr') ptr?: PullToRefreshComponent;
  @ViewChild('priceChart') priceChartCanvas?: ElementRef<HTMLCanvasElement>;

  candles: any[] = [];
  latestCandle: any = null;
  priceChange: number | null = null;
  healthStatus = '';
  healthTone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
  freshLabel = '';
  isLoading = false;
  usingCachedData = false;
  activeTimeframe = 'D1';
  timeframes = this.timeframeContext.timeframes;
  formatWallTime = formatWallTime;

  private chart?: Chart;
  private chartReady = false;

  constructor(
    private http: HttpClient,
    private timeframeContext: TimeframeContextService,
    private marketCache: MarketDataCacheService
  ) {}

  ngOnInit() {
    this.activeTimeframe = this.timeframeContext.current;
    this.timeframeContext.timeframe$.subscribe(tf => {
      if (tf !== this.activeTimeframe) {
        this.activeTimeframe = tf;
        this.loadAll();
      }
    });
    this.loadAll();
  }

  ngAfterViewInit() {
    this.chartReady = true;
    this.renderChart();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  onTimeframeChange(tf: string) {
    this.timeframeContext.setTimeframe(tf);
  }

  onPullRefresh() {
    this.loadAll(true);
  }

  loadAll(fromPull = false) {
    this.isLoading = true;
    this.usingCachedData = false;
    let pending = 2;
    const done = () => {
      pending--;
      if (pending <= 0) {
        this.isLoading = false;
        this.renderChart();
        if (fromPull) this.ptr?.completeRefresh();
      }
    };

    const key = this.marketCache.cacheKey(this.activeTimeframe, 24, false);
    this.marketCache.fetchGrid(this.activeTimeframe, 24, false).subscribe({
      next: data => {
        this.candles = data || [];
        this.latestCandle = this.candles[0] ?? null;
        this.priceChange = this.computeChange();
        done();
      },
      error: () => {
        this.marketCache.getOfflineGrid(key).then(cached => {
          if (cached?.length) {
            this.candles = cached;
            this.latestCandle = this.candles[0] ?? null;
            this.priceChange = this.computeChange();
            this.usingCachedData = true;
          } else {
            this.candles = [];
          }
          done();
        });
      }
    });

    this.http.get<any>(`${environment.apiUrl}/market/xauusd/health`).subscribe({
      next: health => {
        this.healthStatus = health?.status || 'UNKNOWN';
        if (this.healthStatus === 'UP') this.healthTone = 'success';
        else if (this.healthStatus === 'DEGRADED') this.healthTone = 'warning';
        else if (this.healthStatus === 'DOWN') this.healthTone = 'danger';
        this.freshLabel = `${health?.freshCount ?? 0} / ${health?.total ?? 6} timeframes fresh`;
        done();
      },
      error: () => {
        this.healthStatus = 'DOWN';
        this.healthTone = 'danger';
        done();
      }
    });
  }

  private renderChart() {
    if (!this.chartReady || !this.priceChartCanvas || !this.candles.length) return;
    const ctx = this.priceChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.chart?.destroy();
    const chartData = [...this.candles].reverse();
    const labels = chartData.map(d => formatWallTime(d.time));
    const closes = chartData.map(d => d.close);
    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Close',
          data: closes,
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.12)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#71717a', maxTicksLimit: 6 }, grid: { color: '#27272a' } },
          y: { ticks: { color: '#71717a' }, grid: { color: '#27272a' } }
        }
      }
    };
    this.chart = new Chart(ctx, config);
  }

  private computeChange(): number | null {
    if (this.candles.length < 2 || this.candles[0]?.close == null || this.candles[1]?.close == null) return null;
    const curr = this.candles[0].close;
    const prev = this.candles[1].close;
    if (!prev) return null;
    return ((curr - prev) / prev) * 100;
  }
}
