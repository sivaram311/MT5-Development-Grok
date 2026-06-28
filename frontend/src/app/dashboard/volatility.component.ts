import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { PageHeaderComponent } from '../ui/page-header.component';
import { SegmentControlComponent } from '../ui/segment-control.component';
import { PullToRefreshComponent } from '../ui/pull-to-refresh.component';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { PreferencesService } from '../services/preferences.service';
import { TimeframeContextService } from '../services/timeframe-context.service';
import { MarketDataCacheService } from '../services/market-data-cache.service';
import { formatWallTime } from '../utils/time.util';

interface VolatilityRow {
  dayOfWeek: string;
  time: string;
  nyTime: string;
  istTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  diff: number;
  tickVolume: number;
}

interface SortColumn {
  key: keyof VolatilityRow | 'diff';
  label: string;
  align: 'left' | 'right';
  highlight?: boolean;
}

@Component({
  selector: 'app-volatility',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ScrollingModule,
    PageHeaderComponent,
    SegmentControlComponent,
    PullToRefreshComponent,
    EmptyStateComponent
  ],
  template: `
    <app-pull-to-refresh #ptr (refresh)="onPullRefresh()">
      <app-page-header
        title="Volatility Explorer"
        subtitle="High-to-Low ranges across historical candles. Preferences and sort sync to your account.">
        <div toolbar>
          <app-segment-control
            [options]="timeframes"
            [value]="selectedTimeframe"
            ariaLabel="Timeframe"
            (valueChange)="onTimeframeChange($event)">
          </app-segment-control>

            <button type="button" (click)="viewMode = 'cards'" class="min-h-11 px-4 text-sm font-medium rounded-2xl border tablet:hidden"
            [class.bg-white]="viewMode === 'cards'" [class.text-zinc-950]="viewMode === 'cards'" [class.border-white]="viewMode === 'cards'"
            [class.border-zinc-700]="viewMode !== 'cards'" [class.text-zinc-300]="viewMode !== 'cards'">Cards</button>
          <button type="button" (click)="viewMode = 'table'" class="min-h-11 px-4 text-sm font-medium rounded-2xl border tablet:hidden"
            [class.bg-white]="viewMode === 'table'" [class.text-zinc-950]="viewMode === 'table'" [class.border-white]="viewMode === 'table'"
            [class.border-zinc-700]="viewMode !== 'table'" [class.text-zinc-300]="viewMode !== 'table'">Table</button>
          <div class="flex flex-wrap items-end gap-3 mt-3 bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
            <div class="flex flex-col">
              <label class="text-[10px] text-zinc-500 font-medium mb-1 uppercase tracking-wider">Lookback</label>
              <input
                type="number"
                [(ngModel)]="limit"
                (change)="onLimitChange()"
                min="5"
                max="1000"
                class="w-24 min-h-11 bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs outline-none">
            </div>

            <label class="flex items-center gap-2 min-h-11 px-3 rounded-xl border border-zinc-800 bg-zinc-950 text-xs cursor-pointer active:bg-zinc-800">
              <input type="checkbox" [(ngModel)]="nySessionOnly" (change)="onNySessionChange()" class="w-5 h-5 rounded">
              NY Session Only
            </label>

            <button
              type="button"
              (click)="loadData()"
              [disabled]="isLoading"
              class="min-h-11 text-xs font-semibold px-4 rounded-xl border border-emerald-800 text-emerald-400 active:bg-emerald-950 disabled:opacity-50 ml-auto flex items-center gap-1">
              <span *ngIf="isLoading" class="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
              {{ isLoading ? 'Loading…' : 'Refresh' }}
            </button>
          </div>
        </div>
      </app-page-header>

      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div class="px-4 sm:px-5 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-zinc-400 tracking-wider">{{ selectedTimeframe }} · {{ gridData.length }} rows</span>
            <span class="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">{{ sortLabel }}</span>
            <span *ngIf="prefsSavedHint" class="text-[10px] text-emerald-500">Preferences saved</span>
            <span *ngIf="usingCachedData" class="text-[10px] text-amber-400">Offline cache</span>
          </div>
          <button
            type="button"
            (click)="exportToCsv()"
            [disabled]="gridData.length === 0"
            class="min-h-11 text-xs px-3 rounded-xl border border-zinc-700 active:bg-zinc-800 text-zinc-300 disabled:opacity-50">
            Export CSV
          </button>
        </div>

        <app-empty-state *ngIf="isLoading" [loading]="true" loadingMessage="Loading volatility data…"></app-empty-state>

        <div *ngIf="!isLoading && displayRows.length && viewMode === 'cards'" class="tablet:hidden p-3">
          <cdk-virtual-scroll-viewport itemSize="148" class="h-[70vh] w-full">
            <div *cdkVirtualFor="let row of displayRows" class="pb-2">
              <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
                <div class="flex justify-between items-start">
                  <div>
                    <div class="text-xs font-medium text-zinc-300">{{ row.dayOfWeek }}</div>
                    <div class="font-mono text-[10px] text-zinc-500">{{ formatWallTime(row.time) }}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-lg font-semibold tabular-nums" [class.text-amber-400]="isHighlyVolatile(row.diff)">{{ row.diff | number:'1.2-2' }}</div>
                    <div class="text-[10px] text-zinc-500">H-L range</div>
                  </div>
                </div>
                <div class="grid grid-cols-4 gap-2 mt-3 text-center text-xs font-mono">
                  <div><div class="text-zinc-500 text-[10px]">O</div>{{ row.open | number:'1.2-2' }}</div>
                  <div><div class="text-emerald-500 text-[10px]">H</div>{{ row.high | number:'1.2-2' }}</div>
                  <div><div class="text-red-500 text-[10px]">L</div>{{ row.low | number:'1.2-2' }}</div>
                  <div><div class="text-zinc-500 text-[10px]">C</div>{{ row.close | number:'1.2-2' }}</div>
                </div>
              </div>
            </div>
          </cdk-virtual-scroll-viewport>
        </div>

        <div *ngIf="!isLoading && displayRows.length && (viewMode === 'table' || isTabletUp)" class="overflow-x-auto">
          <div class="flex min-w-max border-b border-zinc-800 text-[10px] text-zinc-500 bg-zinc-950 uppercase tracking-widest sticky top-0 z-10">
            <button
              *ngFor="let col of sortColumns"
              type="button"
              (click)="toggleSort(col.key)"
              class="min-h-11 py-3 px-3 font-semibold whitespace-nowrap shrink-0 min-w-[4.5rem] active:bg-zinc-800 text-left"
              [class.text-right]="col.align === 'right'"
              [class.text-emerald-400]="col.highlight">
              {{ col.label }}
              <span *ngIf="sortKey === col.key">{{ sortAsc ? '▲' : '▼' }}</span>
            </button>
          </div>
          <cdk-virtual-scroll-viewport itemSize="40" class="h-[70vh] w-full">
            <div
              *cdkVirtualFor="let row of displayRows"
              class="flex min-w-max border-b border-zinc-800 active:bg-zinc-800/40">
              <div class="px-3 py-2.5 text-zinc-300 font-medium text-xs shrink-0 min-w-[5rem]">{{ row.dayOfWeek }}</div>
              <div class="px-3 py-2.5 font-mono text-xs text-zinc-400 shrink-0 min-w-[6.5rem]">{{ formatWallTime(row.time) }}</div>
              <div class="px-3 py-2.5 font-mono text-xs text-zinc-400 shrink-0 min-w-[6.5rem]">{{ formatWallTime(row.nyTime) }}</div>
              <div class="px-3 py-2.5 font-mono text-xs text-zinc-400 shrink-0 min-w-[6.5rem]">{{ formatWallTime(row.istTime) }}</div>
              <div class="px-3 py-2.5 text-right font-mono text-xs text-zinc-300 shrink-0 min-w-[4.5rem]">{{ row.open | number:'1.2-2' }}</div>
              <div class="px-3 py-2.5 text-right font-mono text-xs text-zinc-300 shrink-0 min-w-[4.5rem]">{{ row.high | number:'1.2-2' }}</div>
              <div class="px-3 py-2.5 text-right font-mono text-xs text-zinc-300 shrink-0 min-w-[4.5rem]">{{ row.low | number:'1.2-2' }}</div>
              <div class="px-3 py-2.5 text-right font-mono text-xs text-zinc-200 font-medium shrink-0 min-w-[4.5rem]">{{ row.close | number:'1.2-2' }}</div>
              <div class="px-3 py-2.5 text-right font-mono text-xs font-semibold shrink-0 min-w-[4.5rem]">
                <span [class.text-amber-400]="isHighlyVolatile(row.diff)" [class.text-zinc-100]="!isHighlyVolatile(row.diff)">
                  {{ row.diff | number:'1.2-2' }}
                </span>
              </div>
            </div>
          </cdk-virtual-scroll-viewport>
        </div>

        <app-empty-state
          *ngIf="!isLoading && !displayRows.length"
          message="No volatility data loaded. Ensure the backend is running and MT5 sync has stored history."
          actionLabel="Retry"
          (actionClick)="loadData()">
        </app-empty-state>

        <div class="px-4 sm:px-5 py-4 bg-zinc-950 border-t border-zinc-800 flex flex-col gap-2 sm:flex-row sm:justify-between text-xs text-zinc-400">
          <div>Analyzed last {{ gridData.length }} candles · virtual scroll</div>
          <div class="flex gap-4">
            <div>Avg: <span class="font-mono font-semibold text-zinc-200">{{ averageDiff | number:'1.2-2' }}</span></div>
            <div>Max: <span class="font-mono font-semibold text-amber-400">{{ maxDiff | number:'1.2-2' }}</span></div>
          </div>
        </div>
      </div>
    </app-pull-to-refresh>
  `
})
export class VolatilityComponent implements OnInit {
  @ViewChild('ptr') ptr?: PullToRefreshComponent;

  gridData: VolatilityRow[] = [];
  displayRows: VolatilityRow[] = [];
  timeframes = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
  selectedTimeframe = 'D1';
  limit = 90;
  nySessionOnly = false;
  isLoading = false;
  usingCachedData = false;
  prefsSavedHint = false;
  viewMode: 'cards' | 'table' = 'cards';
  isTabletUp = false;
  formatWallTime = formatWallTime;

  sortKey = 'diff';
  sortAsc = false;
  averageDiff = 0;
  maxDiff = 0;

  sortColumns: SortColumn[] = [
    { key: 'dayOfWeek', label: 'Day', align: 'left' },
    { key: 'time', label: 'Broker', align: 'left' },
    { key: 'nyTime', label: 'NY', align: 'left' },
    { key: 'istTime', label: 'IST', align: 'left' },
    { key: 'open', label: 'Open', align: 'right' },
    { key: 'high', label: 'High', align: 'right' },
    { key: 'low', label: 'Low', align: 'right' },
    { key: 'close', label: 'Close', align: 'right' },
    { key: 'diff', label: 'Diff', align: 'right', highlight: true }
  ];

  private prefsHintTimer?: ReturnType<typeof setTimeout>;
  private mediaQuery?: MediaQueryList;

  constructor(
    private marketCache: MarketDataCacheService,
    private preferences: PreferencesService,
    private timeframeContext: TimeframeContextService
  ) {}

  ngOnInit() {
    this.mediaQuery = window.matchMedia('(min-width: 800px)');
    this.isTabletUp = this.mediaQuery.matches;
    this.mediaQuery.addEventListener('change', () => {
      this.isTabletUp = this.mediaQuery?.matches ?? false;
      if (this.isTabletUp) this.viewMode = 'table';
    });
    this.preferences.load().subscribe(() => {
      const lastTf = this.preferences.getVolatilityLastTimeframe();
      if (lastTf && this.timeframes.includes(lastTf)) {
        this.selectedTimeframe = lastTf;
      }
      this.applyVolatilityPrefs();
      this.loadData();
    });
  }

  get sortLabel(): string {
    const col = this.sortColumns.find(c => c.key === this.sortKey);
    return `Sort: ${col?.label ?? this.sortKey} ${this.sortAsc ? '↑' : '↓'}`;
  }

  onPullRefresh() {
    this.loadData(true);
  }

  onTimeframeChange(tf: string) {
    this.timeframeContext.setTimeframe(tf);
    this.selectedTimeframe = tf;
    this.applyVolatilityPrefs();
    this.persistVolatilityPrefs();
    this.loadData();
  }

  onLimitChange() {
    if (this.limit < 5) this.limit = 5;
    if (this.limit > 1000) this.limit = 1000;
    this.persistVolatilityPrefs();
    this.loadData();
  }

  onNySessionChange() {
    this.persistVolatilityPrefs();
    this.loadData();
  }

  loadData(fromPull = false) {
    this.isLoading = true;
    this.usingCachedData = false;
    this.marketCache.fetchGridWithFallback(this.selectedTimeframe, this.limit, this.nySessionOnly).subscribe({
      next: result => {
        this.isLoading = false;
        this.usingCachedData = result.offline;
        this.processData(result.rows || []);
        if (fromPull) {
          this.ptr?.completeRefresh();
        }
      },
      error: err => {
        this.isLoading = false;
        console.error('Failed to load volatility grid data', err);
        this.gridData = [];
        this.displayRows = [];
        this.averageDiff = 0;
        this.maxDiff = 0;
        this.ptr?.completeRefresh();
      }
    });
  }

  processData(rawData: any[]) {
    this.gridData = rawData.map(item => {
      const high = item.high || 0;
      const low = item.low || 0;
      return {
        dayOfWeek: this.getDayOfWeek(item.time),
        time: item.time,
        nyTime: item.nyTime,
        istTime: item.istTime,
        open: item.open || 0,
        high,
        low,
        close: item.close || 0,
        diff: high - low,
        tickVolume: item.tickVolume || 0
      };
    });
    this.calculateSummary();
    this.updateDisplayRows();
  }

  toggleSort(key: string) {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = key === 'dayOfWeek' || key === 'time' || key === 'nyTime' || key === 'istTime';
    }
    this.updateDisplayRows();
    this.persistVolatilityPrefs();
  }

  isHighlyVolatile(diff: number): boolean {
    if (this.maxDiff === 0) return false;
    return diff >= this.maxDiff * 0.8;
  }

  exportToCsv() {
    if (!this.displayRows.length) return;
    const headers = ['Day', 'Broker Time', 'New York Time', 'IST Time', 'Open', 'High', 'Low', 'Close', 'Diff (H-L)'];
    const rows = this.displayRows.map(r => [
      r.dayOfWeek,
      r.time,
      r.nyTime,
      r.istTime,
      r.open.toFixed(2),
      r.high.toFixed(2),
      r.low.toFixed(2),
      r.close.toFixed(2),
      r.diff.toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `xauusd_volatility_${this.selectedTimeframe}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private applyVolatilityPrefs() {
    const pref = this.preferences.getVolatilityPref(this.selectedTimeframe);
    this.limit = pref.limit ?? 90;
    this.nySessionOnly = pref.nySessionOnly ?? false;
    this.sortKey = pref.sortKey ?? 'diff';
    this.sortAsc = pref.sortAsc ?? false;
  }

  private persistVolatilityPrefs() {
    this.preferences.saveVolatilityPref(this.selectedTimeframe, {
      limit: this.limit,
      nySessionOnly: this.nySessionOnly,
      sortKey: this.sortKey,
      sortAsc: this.sortAsc
    }).subscribe({
      next: () => this.flashPrefsSaved(),
      error: () => undefined
    });
  }

  private flashPrefsSaved() {
    this.prefsSavedHint = true;
    if (this.prefsHintTimer) {
      clearTimeout(this.prefsHintTimer);
    }
    this.prefsHintTimer = setTimeout(() => {
      this.prefsSavedHint = false;
    }, 2000);
  }

  private updateDisplayRows() {
    this.displayRows = [...this.gridData].sort((a: any, b: any) => {
      const valA = a[this.sortKey];
      const valB = b[this.sortKey];
      if (valA == null) return this.sortAsc ? -1 : 1;
      if (valB == null) return this.sortAsc ? 1 : -1;
      if (typeof valA === 'string' && typeof valB === 'string') {
        return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return this.sortAsc ? (valA - valB) : (valB - valA);
    });
  }

  private calculateSummary() {
    if (this.gridData.length === 0) {
      this.averageDiff = 0;
      this.maxDiff = 0;
      return;
    }
    let total = 0;
    let max = 0;
    this.gridData.forEach(row => {
      total += row.diff;
      if (row.diff > max) max = row.diff;
    });
    this.averageDiff = total / this.gridData.length;
    this.maxDiff = max;
  }

  private getDayOfWeek(dtStr: string): string {
    if (!dtStr) return '—';
    const m = dtStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
    }
    return '—';
  }
}
