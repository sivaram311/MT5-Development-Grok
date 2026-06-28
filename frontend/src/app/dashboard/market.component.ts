import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageHeaderComponent } from '../ui/page-header.component';
import { SegmentControlComponent } from '../ui/segment-control.component';
import { BottomSheetComponent } from '../ui/bottom-sheet.component';
import { CandleCardComponent } from '../ui/candle-card.component';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { PullToRefreshComponent } from '../ui/pull-to-refresh.component';
import { PreferencesService } from '../services/preferences.service';
import { TimeframeContextService } from '../services/timeframe-context.service';
import { MarketDataCacheService } from '../services/market-data-cache.service';
import { formatWallTime } from '../utils/time.util';

const COLUMN_LABELS: Record<string, string> = {
  time: 'Broker',
  nyTime: 'NY',
  istTime: 'IST',
  open: 'Open',
  high: 'High',
  low: 'Low',
  close: 'Close',
  rsi: 'RSI',
  tickVolume: 'Volume'
};

@Component({
  selector: 'app-market',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ScrollingModule,
    PageHeaderComponent,
    SegmentControlComponent,
    BottomSheetComponent,
    CandleCardComponent,
    EmptyStateComponent,
    PullToRefreshComponent
  ],
  template: `
    <app-pull-to-refresh (refresh)="onPullRefresh()" #ptr>
      <app-page-header
        title="Data Explorer"
        subtitle="XAUUSD OHLC grid with Broker, NY, and IST times. Cards on phone, table on larger screens.">
        <div toolbar>
          <app-segment-control
            [options]="timeframes"
            [value]="selectedTimeframe"
            ariaLabel="Timeframe"
            (valueChange)="onTimeframeChange($event)">
          </app-segment-control>

          <div class="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              (click)="setViewMode('cards')"
              class="min-h-11 px-4 text-sm font-medium rounded-2xl border transition-colors tablet:hidden"
              [class.bg-white]="viewMode === 'cards'"
              [class.text-zinc-950]="viewMode === 'cards'"
              [class.border-white]="viewMode === 'cards'"
              [class.border-zinc-700]="viewMode !== 'cards'"
              [class.text-zinc-300]="viewMode !== 'cards'">
              Cards
            </button>
            <button
              type="button"
              (click)="setViewMode('table')"
              class="min-h-11 px-4 text-sm font-medium rounded-2xl border transition-colors tablet:hidden"
              [class.bg-white]="viewMode === 'table'"
              [class.text-zinc-950]="viewMode === 'table'"
              [class.border-white]="viewMode === 'table'"
              [class.border-zinc-700]="viewMode !== 'table'"
              [class.text-zinc-300]="viewMode !== 'table'">
              Table
            </button>
            <button
              type="button"
              (click)="filterSheetOpen = true"
              class="min-h-11 px-4 text-sm font-medium rounded-2xl border border-zinc-700 active:bg-zinc-900 flex items-center gap-2">
              <span>Filters</span>
              <span *ngIf="nySessionOnly" class="w-2 h-2 rounded-full bg-emerald-400"></span>
            </button>
            <button
              type="button"
              (click)="columnSheetOpen = true"
              class="min-h-11 px-4 text-sm font-medium rounded-2xl border border-zinc-700 active:bg-zinc-900 hidden sm:inline-flex">
              Columns
            </button>
            <button
              type="button"
              (click)="loadData()"
              [disabled]="isLoading"
              class="min-h-11 px-4 text-sm font-semibold rounded-2xl border border-emerald-800 text-emerald-400 active:bg-emerald-950 disabled:opacity-50 ml-auto sm:ml-0">
              {{ isLoading ? 'Loading…' : 'Refresh' }}
            </button>
          </div>
        </div>
      </app-page-header>

      <app-bottom-sheet [open]="filterSheetOpen" title="Filters &amp; actions" (close)="filterSheetOpen = false">
        <div class="space-y-4">
          <label class="flex items-center gap-3 min-h-11 px-3 rounded-2xl bg-zinc-950 border border-zinc-800 cursor-pointer active:bg-zinc-800">
            <input
              type="checkbox"
              class="w-5 h-5 rounded border-zinc-600 text-emerald-500"
              [ngModel]="nySessionOnly"
              (ngModelChange)="onNySessionOnlyChange($event)">
            <div>
              <div class="text-sm font-medium">NY Session Only</div>
              <div class="text-xs text-zinc-500">Reconstruct D1 bars from NY session M15 data</div>
            </div>
          </label>
          <button type="button" (click)="columnSheetOpen = true; filterSheetOpen = false"
            class="w-full min-h-11 px-4 text-sm rounded-2xl border border-zinc-700 active:bg-zinc-800 text-left">
            Customize columns
          </button>
          <button type="button" (click)="copyVisibleTsv()" [disabled]="gridData.length === 0"
            class="w-full min-h-11 px-4 text-sm rounded-2xl border border-zinc-700 active:bg-zinc-800 disabled:opacity-50 text-left">
            Copy visible data (TSV)
          </button>
          <button type="button" (click)="exportCsv()" [disabled]="gridData.length === 0"
            class="w-full min-h-11 px-4 text-sm rounded-2xl border border-zinc-700 active:bg-zinc-800 disabled:opacity-50 text-left">
            Export CSV
          </button>
          <button type="button" (click)="loadData(); filterSheetOpen = false"
            class="w-full min-h-11 px-4 text-sm font-semibold rounded-2xl bg-emerald-600 text-white active:bg-emerald-700">
            Apply &amp; refresh
          </button>
        </div>
      </app-bottom-sheet>

      <app-bottom-sheet [open]="columnSheetOpen" title="Columns — drag or use arrows" (close)="closeColumnSheet()">
        <div class="flex flex-wrap gap-2 mb-4">
          <button *ngFor="let preset of columnPresets" type="button" (click)="applyColumnPreset(preset.key)"
            class="min-h-9 px-3 text-xs font-medium rounded-full border border-zinc-700 active:bg-zinc-800">
            {{ preset.label }}
          </button>
        </div>
        <p class="text-[10px] text-zinc-500 mb-3">Order and visibility sync to your account via the backend.</p>
        <div class="space-y-1">
          <div
            *ngFor="let key of columnOrder"
            draggable="true"
            (dragstart)="onColumnDragStart($event, key)"
            (dragover)="onColumnDragOver($event)"
            (drop)="onColumnDrop($event, key)"
            class="flex items-center gap-2 min-h-11 px-3 rounded-2xl bg-zinc-950 border border-zinc-800 active:bg-zinc-800">
            <span class="text-zinc-600 select-none touch-none px-1" aria-hidden="true">⋮⋮</span>
            <input type="checkbox" class="w-5 h-5 rounded shrink-0" [checked]="isColumnVisible(key)"
              (change)="toggleColumn(key)">
            <span class="text-sm flex-1 min-w-0 truncate">{{ getColumnLabel(key) }}</span>
            <button type="button" (click)="moveColumn(key, 'up')" class="min-h-9 min-w-9 rounded-xl active:bg-zinc-700 text-sm" aria-label="Move up">↑</button>
            <button type="button" (click)="moveColumn(key, 'down')" class="min-h-9 min-w-9 rounded-xl active:bg-zinc-700 text-sm" aria-label="Move down">↓</button>
          </div>
        </div>
      </app-bottom-sheet>

      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <div class="px-4 sm:px-5 py-3 border-b border-zinc-800 text-xs text-zinc-400 flex flex-wrap items-center gap-2">
          <span class="font-semibold tracking-wide">{{ selectedTimeframe }} · {{ gridData.length }} rows</span>
          <span *ngIf="nySessionOnly" class="px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 text-[10px]">NY Session</span>
        <span *ngIf="usingCachedData" class="px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 text-[10px]">Cached</span>
          <span *ngIf="prefsSavedHint" class="text-emerald-500 text-[10px]">Preferences saved</span>
          <span class="sm:ml-auto text-[10px] uppercase tracking-wider">Newest first · virtual scroll</span>
        </div>

        <div *ngIf="!isTabletUp && viewMode === 'cards'" class="tablet:hidden">
          <app-empty-state *ngIf="!isLoading && gridData.length === 0" [message]="emptyMessage"
            actionLabel="Retry" (actionClick)="loadData()"></app-empty-state>
          <app-empty-state *ngIf="isLoading" [loading]="true" loadingMessage="Loading market data…"></app-empty-state>
          <cdk-virtual-scroll-viewport *ngIf="!isLoading && gridData.length" itemSize="132" minBufferPx="200" maxBufferPx="400" class="h-[70vh] p-3">
            <app-candle-card *cdkVirtualFor="let row of gridData; trackBy: trackGridRow" [row]="row" class="block mb-2"></app-candle-card>
          </cdk-virtual-scroll-viewport>
        </div>

        <div *ngIf="isTabletUp || viewMode === 'table'" class="overflow-x-auto">
          <div *ngIf="isTabletUp && selectedRow" class="hidden tablet:grid tablet:grid-cols-2 gap-4 p-4 border-b border-zinc-800">
            <app-candle-card [row]="selectedRow"></app-candle-card>
            <div class="text-xs text-zinc-400 leading-relaxed flex items-center">Tap any row below to inspect OHLC details on tablet split view.</div>
          </div>
          <app-empty-state *ngIf="isLoading" [loading]="true" loadingMessage="Loading market data…"></app-empty-state>
          <ng-container *ngIf="!isLoading && gridData.length">
            <div class="flex min-w-max border-b border-zinc-800 text-[10px] text-zinc-400 bg-zinc-950 uppercase tracking-wider sticky top-0 z-10">
              <div *ngFor="let col of visibleColumns" class="py-3 px-3 font-medium text-left whitespace-nowrap shrink-0 min-w-[4.5rem]">{{ col.label }}</div>
            </div>
            <cdk-virtual-scroll-viewport itemSize="40" minBufferPx="200" maxBufferPx="400" class="h-[70vh] w-full">
              <div *cdkVirtualFor="let row of gridData; trackBy: trackGridRow" (click)="selectRow(row)" class="flex min-w-max border-b border-zinc-800 active:bg-zinc-800/40 cursor-pointer" [class.bg-zinc-800]="selectedRow === row">
                <div *ngFor="let col of visibleColumns" class="px-3 py-2.5 font-mono text-xs whitespace-nowrap shrink-0 min-w-[4.5rem]">
                  <ng-container [ngSwitch]="col.key">
                    <span *ngSwitchCase="'time'">{{ formatWallTime(row.time) }}</span>
                    <span *ngSwitchCase="'nyTime'">{{ formatWallTime(row.nyTime) }}</span>
                    <span *ngSwitchCase="'istTime'">{{ formatWallTime(row.istTime) }}</span>
                    <span *ngSwitchCase="'open'">{{ row.open | number:'1.2-2' }}</span>
                    <span *ngSwitchCase="'high'">{{ row.high | number:'1.2-2' }}</span>
                    <span *ngSwitchCase="'low'">{{ row.low | number:'1.2-2' }}</span>
                    <span *ngSwitchCase="'close'">{{ row.close | number:'1.2-2' }}</span>
                    <span *ngSwitchCase="'rsi'">
                      <span *ngIf="row.rsi != null" class="px-1.5 py-px rounded text-xs bg-emerald-900 text-emerald-400">{{ row.rsi | number:'1.1-1' }}</span>
                      <span *ngIf="row.rsi == null" class="text-zinc-600">—</span>
                    </span>
                    <span *ngSwitchCase="'tickVolume'">{{ (row.tickVolume / 1000) | number:'1.0-0' }}k</span>
                  </ng-container>
                </div>
              </div>
            </cdk-virtual-scroll-viewport>
          </ng-container>
          <app-empty-state *ngIf="!isLoading && gridData.length === 0" [message]="emptyMessage"
            actionLabel="Retry" (actionClick)="loadData()"></app-empty-state>
        </div>

        <div class="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex flex-wrap justify-between gap-2 text-xs text-zinc-400">
          <span>Up to 500 candles · CDK virtual scroll</span>
          <button type="button" (click)="loadData()" class="text-emerald-400 min-h-11 px-2 active:text-emerald-300">Refresh grid</button>
        </div>
      </div>
    </app-pull-to-refresh>
  `
})
export class MarketComponent implements OnInit, OnDestroy {
  @ViewChild('ptr') ptr?: PullToRefreshComponent;

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  columnSheetOpen = false;
  filterSheetOpen = false;
  gridData: any[] = [];
  selectedTimeframe = 'D1';
  timeframes = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
  nySessionOnly = false;
  isLoading = false;
  viewMode: 'cards' | 'table' = 'cards';
  isTabletUp = false;
  prefsSavedHint = false;
  usingCachedData = false;
  selectedRow: any = null;
  formatWallTime = formatWallTime;

  columnOrder: string[] = [];
  columnVisibility: Record<string, boolean> = {};
  visibleColumns: { key: string; label: string }[] = [];
  emptyMessage = 'No data loaded. Run the Python MT5 downloader and ensure the backend is serving data.';

  columnPresets = [
    { key: 'all', label: 'All' },
    { key: 'core', label: 'Core + Times' },
    { key: 'rsi', label: 'RSI' },
    { key: 'minimal', label: 'Minimal' }
  ];

  private mediaQuery?: MediaQueryList;
  private mediaListener = () => this.updateViewport();
  private prefsHintTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private http: HttpClient,
    private preferences: PreferencesService,
    private timeframeContext: TimeframeContextService,
    private marketCache: MarketDataCacheService
  ) {}

  ngOnInit() {
    this.mediaQuery = window.matchMedia('(min-width: 800px)');
    this.updateViewport();
    this.mediaQuery.addEventListener('change', this.mediaListener);

    this.preferences.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.selectedTimeframe = this.timeframeContext.current;
      const ui = this.preferences.getMarketUi();
      if (ui.viewMode && !this.isTabletUp) {
        this.viewMode = ui.viewMode;
      }
      if (typeof ui.nySessionOnly === 'boolean') {
        this.nySessionOnly = ui.nySessionOnly;
      }
      this.applyGridPrefsForTimeframe();
      this.loadData();
    });

    this.timeframeContext.timeframe$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tf => {
      if (tf !== this.selectedTimeframe) {
        this.selectedTimeframe = tf;
        this.applyGridPrefsForTimeframe();
        this.loadData();
      }
    });
  }

  ngOnDestroy() {
    this.mediaQuery?.removeEventListener('change', this.mediaListener);
    if (this.prefsHintTimer) {
      clearTimeout(this.prefsHintTimer);
    }
  }

  onPullRefresh() {
    this.loadData(true);
  }

  onTimeframeChange(tf: string) {
    this.timeframeContext.setTimeframe(tf);
  }

  setViewMode(mode: 'cards' | 'table') {
    this.viewMode = mode;
    this.preferences.saveMarketUi({ viewMode: mode }).subscribe({
      next: () => this.flashPrefsSaved()
    });
  }

  loadData(fromPull = false) {
    this.isLoading = true;
    this.usingCachedData = false;
    this.cdr.markForCheck();
    this.marketCache.fetchGridWithFallback(this.selectedTimeframe, 500, this.nySessionOnly).subscribe({
      next: result => {
        this.gridData = result.rows || [];
        this.usingCachedData = result.offline;
        this.selectedRow = this.gridData[0] ?? null;
        this.isLoading = false;
        this.ptr?.completeRefresh();
        this.cdr.markForCheck();
      },
      error: () => {
        this.gridData = [];
        this.selectedRow = null;
        this.emptyMessage = 'Failed to load data. Check that the backend is running on port 8081.';
        this.isLoading = false;
        this.ptr?.completeRefresh();
        this.cdr.markForCheck();
      }
    });
  }

  trackGridRow(_index: number, row: { time?: string }): string {
    return row.time ?? String(_index);
  }

  selectRow(row: any) {
    this.selectedRow = row;
    this.cdr.markForCheck();
  }

  getVisibleColumns(): { key: string; label: string }[] {
    return this.visibleColumns;
  }

  getColumnLabel(key: string): string {
    return COLUMN_LABELS[key] || key;
  }

  isColumnVisible(key: string): boolean {
    return this.columnVisibility[key] !== false;
  }

  onNySessionOnlyChange(value: boolean) {
    this.nySessionOnly = value;
    this.preferences.saveMarketUi({ nySessionOnly: value }).subscribe();
    this.loadData();
  }

  applyColumnPreset(key: string) {
    const allKeys = Object.keys(COLUMN_LABELS);
    const sets: Record<string, string[]> = {
      all: allKeys,
      core: ['time', 'nyTime', 'istTime', 'open', 'high', 'low', 'close'],
      rsi: ['time', 'nyTime', 'istTime', 'rsi'],
      minimal: ['open', 'high', 'low', 'close']
    };
    const visible = sets[key] || allKeys;
    allKeys.forEach(k => {
      this.columnVisibility[k] = visible.includes(k);
    });
    this.rebuildVisibleColumns();
    this.persistGridPrefs();
  }

  toggleColumn(key: string) {
    this.columnVisibility[key] = !this.isColumnVisible(key);
    if (this.isColumnVisible(key) && !this.columnOrder.includes(key)) {
      this.columnOrder.push(key);
    }
    this.rebuildVisibleColumns();
    this.persistGridPrefs();
  }

  moveColumn(key: string, direction: 'up' | 'down') {
    const idx = this.columnOrder.indexOf(key);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= this.columnOrder.length) return;
    [this.columnOrder[idx], this.columnOrder[newIdx]] = [this.columnOrder[newIdx], this.columnOrder[idx]];
    this.rebuildVisibleColumns();
    this.persistGridPrefs();
  }

  onColumnDragStart(event: DragEvent, key: string) {
    event.dataTransfer?.setData('text/plain', key);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onColumnDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onColumnDrop(event: DragEvent, targetKey: string) {
    event.preventDefault();
    const draggedKey = event.dataTransfer?.getData('text/plain');
    if (!draggedKey || draggedKey === targetKey) return;
    const fromIdx = this.columnOrder.indexOf(draggedKey);
    const toIdx = this.columnOrder.indexOf(targetKey);
    if (fromIdx > -1 && toIdx > -1) {
      const [moved] = this.columnOrder.splice(fromIdx, 1);
      this.columnOrder.splice(toIdx, 0, moved);
      this.rebuildVisibleColumns();
      this.persistGridPrefs();
    }
  }

  closeColumnSheet() {
    this.columnSheetOpen = false;
    this.persistGridPrefs();
  }

  copyVisibleTsv() {
    const cols = this.getVisibleColumns();
    const header = cols.map(c => c.label).join('\t');
    const rows = this.gridData.map(row => cols.map(col => this.cellValue(row, col.key)).join('\t'));
    const tsv = [header, ...rows].join('\n');
    navigator.clipboard?.writeText(tsv).catch(() => undefined);
  }

  exportCsv() {
    const cols = this.getVisibleColumns();
    if (!cols.length || !this.gridData.length) return;
    const escape = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    const lines = [
      cols.map(c => c.label).join(','),
      ...this.gridData.map(row => cols.map(col => escape(this.cellValue(row, col.key))).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `xauusd_${this.selectedTimeframe}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private applyGridPrefsForTimeframe() {
    const pref = this.preferences.getGridPref(this.selectedTimeframe);
    this.columnVisibility = { ...pref.visibility };
    this.columnOrder = [...pref.order];
    this.rebuildVisibleColumns();
  }

  private rebuildVisibleColumns(): void {
    this.visibleColumns = this.columnOrder
      .filter(k => this.isColumnVisible(k))
      .map(k => ({ key: k, label: this.getColumnLabel(k) }));
    this.cdr.markForCheck();
  }

  private persistGridPrefs() {
    this.preferences.saveGridPref(this.selectedTimeframe, this.columnVisibility, this.columnOrder).subscribe({
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
      this.cdr.markForCheck();
    }, 2000);
  }

  private cellValue(row: any, key: string): string {
    switch (key) {
      case 'time':
      case 'nyTime':
      case 'istTime':
        return formatWallTime(row[key]);
      case 'tickVolume':
        return row.tickVolume != null ? `${Math.round(row.tickVolume / 1000)}k` : '';
      default:
        return row[key] != null ? String(row[key]) : '';
    }
  }

  private updateViewport() {
    this.isTabletUp = this.mediaQuery?.matches ?? false;
    if (this.isTabletUp) {
      this.viewMode = 'table';
    }
    this.cdr.markForCheck();
  }
}
