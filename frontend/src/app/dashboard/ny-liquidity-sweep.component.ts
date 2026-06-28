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
import { environment } from '../../environments/environment';
import { PageHeaderComponent } from '../ui/page-header.component';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { PullToRefreshComponent } from '../ui/pull-to-refresh.component';
import { NyLiquiditySweepStreamService, LiquiditySetup } from '../services/ny-liquidity-sweep-stream.service';
import { formatWallTime } from '../utils/time.util';

Chart.register(...registerables);

interface LiquidityStats {
  totalSetups: number;
  wins: number;
  losses: number;
  openSetups: number;
  winRate: number;
  averageRr: number;
}

@Component({
  selector: 'app-ny-liquidity-sweep',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PageHeaderComponent, StatusBadgeComponent, EmptyStateComponent, PullToRefreshComponent],
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
            Interactive chart
            <span *ngIf="selectedSetup"> · {{ selectedSetup.date }} {{ selectedSetup.ny_time }} NY</span>
          </div>
          <app-status-badge *ngIf="selectedSetup" [label]="selectedSetup.direction" [tone]="selectedSetup.direction === 'Bullish' ? 'success' : 'warning'"></app-status-badge>
        </div>
        <div *ngIf="chartLoading" class="h-64 flex items-center justify-center text-zinc-500 text-sm">Loading chart…</div>
        <div *ngIf="!chartLoading && !selectedSetup" class="h-48 flex items-center justify-center text-zinc-500 text-sm">Select a setup below to view chart with levels</div>
        <div class="relative h-72" [class.hidden]="chartLoading || !selectedSetup">
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
  formatWallTime = formatWallTime;

  constructor(
    private http: HttpClient,
    private stream: NyLiquiditySweepStreamService
  ) {}

  ngOnInit(): void {
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

  selectSetup(row: LiquiditySetup): void {
    this.selectedSetup = row;
    this.chartLoading = true;
    this.cdr.markForCheck();
    this.http.get<any>(`${environment.apiUrl}/market/xauusd/ny-liquidity-sweep/chart/${encodeURIComponent(row.setup_id)}`).subscribe({
      next: data => {
        this.chartLoading = false;
        this.buildChart(data);
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

  private buildChart(data: any): void {
    if (!this.chartCanvas?.nativeElement) return;
    this.chart?.destroy();
    const candles: any[] = data?.candles || [];
    const levels = data?.levels || {};
    const labels = candles.map(c => {
      const t = c.nyTime || c.time || '';
      return t.length > 11 ? t.substring(11, 16) : t;
    });
    const closes = candles.map(c => c.close);

    const datasets: ChartConfiguration<'line'>['data']['datasets'] = [
      {
        label: 'Close',
        data: closes,
        borderColor: '#34d399',
        backgroundColor: 'rgba(52, 211, 153, 0.1)',
        pointRadius: 0,
        borderWidth: 1.5,
        tension: 0.1
      }
    ];

    const levelColors: Record<string, string> = {
      sweep: '#fbbf24',
      structure: '#a1a1aa',
      entry: '#34d399',
      sl: '#f87171',
      tp1: '#6ee7b7',
      tp2: '#a7f3d0'
    };
    for (const [key, color] of Object.entries(levelColors)) {
      const val = levels[key];
      if (val != null && closes.length) {
        datasets.push({
          label: key.toUpperCase(),
          data: closes.map(() => val),
          borderColor: color,
          borderDash: key === 'sl' || key.startsWith('tp') ? [6, 4] : [],
          pointRadius: 0,
          borderWidth: 1
        });
      }
    }

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: '#a1a1aa', boxWidth: 12, font: { size: 10 } } }
        },
        scales: {
          x: { ticks: { color: '#71717a', maxTicksLimit: 12, font: { size: 9 } }, grid: { color: '#27272a' } },
          y: { ticks: { color: '#71717a', font: { size: 9 } }, grid: { color: '#27272a' } }
        }
      }
    });
  }
}
