import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription, forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { PageHeaderComponent } from '../ui/page-header.component';
import { SegmentControlComponent } from '../ui/segment-control.component';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { PullToRefreshComponent } from '../ui/pull-to-refresh.component';
import { MarketDataCacheService } from '../services/market-data-cache.service';
import { formatWallTime } from '../utils/time.util';
import {
  computeGannIntradayStudy,
  GannIntradayStudy,
  oddEvenCellValue
} from '../utils/gann-intraday.util';
import { SessionPivotKey } from '../utils/gann-session-pivot.util';
import { GannGridRowDef } from '../utils/gann-grid-rows.util';
import { ReversalSeverity } from '../utils/gann-killzone.util';
import { GannIntradayStreamService } from '../services/gann-intraday-stream.service';
import { buildGannAboveRows, buildGannBelowRows } from '../utils/gann-grid-rows.util';

@Component({
  selector: 'app-gann-intraday',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    PageHeaderComponent,
    SegmentControlComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    PullToRefreshComponent
  ],
  template: `
    <app-pull-to-refresh #ptr (refresh)="refresh()">
      <app-page-header
        title="Gann Intraday"
        subtitle="1×1 angles · session pivots · fine So9 · time squaring · NY killzones — XAUUSD mean reversion.">
        <div actions class="flex flex-wrap items-center gap-2">
          <app-status-badge
            *ngIf="study"
            [label]="streamConnected ? 'LIVE' : (offline ? 'OFFLINE DATA' : 'GRID')"
            [tone]="streamConnected ? 'success' : (offline ? 'warning' : 'neutral')">
          </app-status-badge>
          <a routerLink="../docs" fragment="gann-intraday" class="min-h-11 px-4 text-xs font-semibold rounded-2xl border border-zinc-700 active:bg-zinc-900 inline-flex items-center">
            Docs
          </a>
        </div>
        <div toolbar class="flex flex-wrap gap-3">
          <app-segment-control
            [options]="entryTfOptions"
            [value]="entryTf"
            ariaLabel="Entry timeframe"
            (valueChange)="entryTf = $event; refresh()">
          </app-segment-control>
          <app-segment-control
            [options]="pivotOptions"
            [value]="so9PivotKey"
            ariaLabel="So9 pivot source"
            (valueChange)="setPivot($event)">
          </app-segment-control>
          <button
            type="button"
            (click)="refresh()"
            [disabled]="loading"
            class="min-h-11 px-4 text-sm font-semibold rounded-2xl border border-emerald-800 text-emerald-400 active:bg-emerald-950 disabled:opacity-50">
            {{ loading ? 'Loading…' : 'Refresh' }}
          </button>
        </div>
        <div toolbar class="flex flex-wrap gap-3 mt-2">
          <label class="text-xs text-zinc-500 flex items-center gap-2">
            Time scale
            <input type="range" min="0.5" max="2" step="0.1" [(ngModel)]="timeScaleFactor" (change)="refresh()" class="w-24" />
            <span class="font-mono text-zinc-300">{{ timeScaleFactor | number:'1.1-1' }}</span>
          </label>
          <label class="text-xs text-zinc-500 flex items-center gap-2">
            ATR alert
            <input type="range" min="0.75" max="2.5" step="0.05" [(ngModel)]="extensionThresholdAtr" (change)="refresh()" class="w-24" />
            <span class="font-mono text-zinc-300">{{ extensionThresholdAtr | number:'1.2-2' }}×</span>
          </label>
        </div>
      </app-page-header>

      <app-empty-state *ngIf="loading" [loading]="true" loadingMessage="Computing intraday Gann study…"></app-empty-state>

      <div *ngIf="!loading && study" class="space-y-4">
        <!-- Module 5 — Reversal alert banner -->
        <div
          class="rounded-3xl border px-4 py-4"
          [ngClass]="alertBannerClass(study.reversalAlert.severity)">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-xs uppercase tracking-wider text-zinc-400 mb-1">Reversal confluence</div>
              <div class="text-base font-semibold">{{ study.reversalAlert.setup }}</div>
              <ul *ngIf="study.reversalAlert.reasons.length" class="mt-2 space-y-1 text-sm text-zinc-300">
                <li *ngFor="let r of study.reversalAlert.reasons">• {{ r }}</li>
              </ul>
            </div>
            <app-status-badge
              [label]="study.reversalAlert.severity.toUpperCase()"
              [tone]="severityTone(study.reversalAlert.severity)">
            </app-status-badge>
          </div>
        </div>

        <!-- Session pivots summary -->
        <div class="grid mobile:grid-cols-2 tablet:grid-cols-3 gap-3">
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase">PDH</div>
            <div class="text-lg font-semibold tabular-nums mt-1">{{ study.session.pdh | number:'1.2-2' }}</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase">PDL</div>
            <div class="text-lg font-semibold tabular-nums mt-1">{{ study.session.pdl | number:'1.2-2' }}</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase">NY open</div>
            <div class="text-lg font-semibold tabular-nums mt-1 text-emerald-400">
              {{ study.session.nySessionOpen != null ? (study.session.nySessionOpen | number:'1.2-2') : '—' }}
            </div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase">So9 pivot ({{ pivotLabel(study.so9PivotKey) }})</div>
            <div class="text-lg font-semibold tabular-nums mt-1 text-amber-300">{{ study.so9PivotPrice | number:'1.2-2' }}</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase">Current · {{ entryTf }}</div>
            <div class="text-lg font-semibold tabular-nums mt-1">{{ study.currentPrice | number:'1.2-2' }}</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase">London open</div>
            <div class="text-lg font-semibold tabular-nums mt-1">
              {{ study.session.londonSessionOpen != null ? (study.session.londonSessionOpen | number:'1.2-2') : '—' }}
            </div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase">Killzones active</div>
            <div class="text-sm font-medium mt-1">{{ activeKillzoneLabels(study) || 'None' }}</div>
          </div>
        </div>

        <!-- Module 1 — 1×1 Gann angle -->
        <section class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <div class="px-4 py-3 border-b border-zinc-800">
            <div class="font-medium">1×1 Gann angle</div>
            <div class="text-xs text-zinc-500 mt-0.5">Equilibrium vs price — mean reversion bias</div>
          </div>
          <div class="p-4 grid mobile:grid-cols-2 tablet:grid-cols-4 gap-3">
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">Equilibrium</div>
              <div class="font-mono text-sm mt-1">{{ study.angle.equilibriumPrice | number:'1.2-2' }}</div>
            </div>
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">Deviation</div>
              <div class="font-mono text-sm mt-1" [ngClass]="deviationClass(study)">
                {{ study.angle.deviation | number:'1.2-2' }} ({{ study.angle.deviationAtr | number:'1.2-2' }}× ATR)
              </div>
            </div>
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">1×1 slope / bar</div>
              <div class="font-mono text-sm mt-1">{{ study.angle.oneByOneSlope | number:'1.2-2' }}</div>
            </div>
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">Bias</div>
              <app-status-badge class="inline-block mt-1" [label]="biasLabel(study)" [tone]="biasTone(study)"></app-status-badge>
            </div>
            <div *ngIf="study.angle.angleAlert">
              <div class="text-[10px] text-zinc-500 uppercase">1×1 alert</div>
              <app-status-badge class="inline-block mt-1" label="ATR THRESHOLD" tone="warning"></app-status-badge>
            </div>
          </div>
          <div class="px-4 pb-4 border-t border-zinc-800/50">
            <div class="text-[10px] text-zinc-500 uppercase py-2">45° fan projection (1×1 / 2×1 / 1×2)</div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-zinc-500">
                    <th class="text-left py-1">+bars</th>
                    <th class="text-right py-1">1×1</th>
                    <th class="text-right py-1">2×1</th>
                    <th class="text-right py-1">1×2</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let f of study.angle.fanLines | slice:0:6" class="border-t border-zinc-800/40">
                    <td class="py-1">{{ f.barsAhead }}</td>
                    <td class="text-right font-mono">{{ f.oneByOne | number:'1.2-2' }}</td>
                    <td class="text-right font-mono">{{ f.twoByOne | number:'1.2-2' }}</td>
                    <td class="text-right font-mono">{{ f.oneByTwo | number:'1.2-2' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Module 3 + 2 — So9 odd/even + fine steps -->
        <section class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <div class="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="font-medium">Square of Nine</div>
              <div class="text-xs text-zinc-500 mt-0.5">Odd/even diagonals + fine 0.25 / 0.5 / 1.0 steps</div>
            </div>
            <div class="flex rounded-xl border border-zinc-700 overflow-hidden text-xs font-medium">
              <button type="button" class="px-3 py-2 transition-colors" [class.bg-zinc-700]="showOdd" [class.text-zinc-100]="showOdd" (click)="showOdd = !showOdd">Odd Sq</button>
              <button type="button" class="px-3 py-2 border-l border-zinc-700 transition-colors" [class.bg-zinc-700]="showEven" [class.text-zinc-100]="showEven" (click)="showEven = !showEven">Even Sq</button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
                  <th class="text-left px-4 py-2 font-medium">Level</th>
                  <th class="text-right px-4 py-2 font-medium">Price</th>
                  <th class="text-right px-4 py-2 font-medium hidden mobile:table-cell">Hint</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of study.fineAbove" class="border-b border-zinc-800/50 bg-teal-950/10">
                  <td class="px-4 py-2 text-teal-300">{{ row.label }}</td>
                  <td class="px-4 py-2 text-right font-mono tabular-nums" [ngClass]="nearPriceClass(row.price)">{{ row.price | number:'1.2-2' }}</td>
                  <td class="px-4 py-2 text-right text-zinc-500 hidden mobile:table-cell">{{ row.angleHint }}</td>
                </tr>
                <tr *ngFor="let row of aboveOddEvenRows" class="border-b border-zinc-800/50" [ngClass]="gannRowBgClass(row)">
                  <td class="px-4 py-2" [ngClass]="gannRowTextClass(row)">{{ row.label }}</td>
                  <td class="px-4 py-2 text-right font-mono tabular-nums" [ngClass]="nearPriceClass(oddEvenVal(row))">
                    {{ oddEvenVal(row) != null ? (oddEvenVal(row)! | number:'1.2-2') : '—' }}
                  </td>
                  <td class="px-4 py-2 text-right text-zinc-500 hidden mobile:table-cell">So9</td>
                </tr>
                <tr class="border-b border-zinc-700 bg-amber-950/20">
                  <td class="px-4 py-2 font-semibold text-amber-300">Pivot</td>
                  <td class="px-4 py-2 text-right font-mono font-semibold text-amber-300 tabular-nums">{{ study.so9PivotPrice | number:'1.2-2' }}</td>
                  <td class="px-4 py-2 hidden mobile:table-cell"></td>
                </tr>
                <tr *ngFor="let row of belowOddEvenRows" class="border-b border-zinc-800/50" [ngClass]="gannRowBgClass(row)">
                  <td class="px-4 py-2" [ngClass]="gannRowTextClass(row)">{{ row.label }}</td>
                  <td class="px-4 py-2 text-right font-mono tabular-nums" [ngClass]="nearPriceClass(oddEvenVal(row))">
                    {{ oddEvenVal(row) != null ? (oddEvenVal(row)! | number:'1.2-2') : '—' }}
                  </td>
                  <td class="px-4 py-2 text-right text-zinc-500 hidden mobile:table-cell">So9</td>
                </tr>
                <tr *ngFor="let row of study.fineBelow" class="border-b border-zinc-800/50 bg-teal-950/10">
                  <td class="px-4 py-2 text-teal-300">{{ row.label }}</td>
                  <td class="px-4 py-2 text-right font-mono tabular-nums" [ngClass]="nearPriceClass(row.price)">{{ row.price | number:'1.2-2' }}</td>
                  <td class="px-4 py-2 text-right text-zinc-500 hidden mobile:table-cell">{{ row.angleHint }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Module 4 — Time squaring -->
        <section *ngIf="study.timeSquare" class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <div class="px-4 py-3 border-b border-zinc-800">
            <div class="font-medium">Time squaring</div>
            <div class="text-xs text-zinc-500 mt-0.5">
              NY session · {{ formatWallTime(study.timeSquare.sessionStart) }} · {{ study.timeSquare.minutesElapsed }} min elapsed
            </div>
          </div>
          <div class="p-4 grid mobile:grid-cols-3 gap-3 mb-2">
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">Price move</div>
              <div class="font-mono text-sm mt-1">{{ study.timeSquare.priceMove | number:'1.2-2' }}</div>
            </div>
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">Abs move</div>
              <div class="font-mono text-sm mt-1">{{ study.timeSquare.absPriceMove | number:'1.2-2' }}</div>
            </div>
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">$/min</div>
              <div class="font-mono text-sm mt-1">{{ study.timeSquare.ratioPricePerMin | number:'1.3-3' }}</div>
            </div>
          </div>
          <div class="divide-y divide-zinc-800">
            <div
              *ngFor="let m of study.timeSquare.milestones"
              class="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
              [ngClass]="{ 'bg-emerald-950/25': m.nearSquare }">
              <div class="text-sm font-medium">{{ m.label }}</div>
              <div class="text-right">
                <div class="font-mono text-sm tabular-nums">Target {{ m.priceTarget | number:'1.2-2' }}</div>
                <app-status-badge *ngIf="m.nearSquare" class="inline-block mt-1" label="NEAR SQUARE" tone="success"></app-status-badge>
              </div>
            </div>
          </div>
        </section>

        <!-- Module 5 — Killzones -->
        <section class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <div class="px-4 py-3 border-b border-zinc-800">
            <div class="font-medium">NY killzones</div>
            <div class="text-xs text-zinc-500 mt-0.5">Filter mean-reversion setups to high-probability windows</div>
          </div>
          <div class="divide-y divide-zinc-800">
            <div *ngFor="let z of study.killzones" class="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="text-sm font-medium">{{ z.label }}</div>
                <div class="text-[10px] text-zinc-500 mt-0.5">{{ z.window }} · {{ z.istWindow }}</div>
              </div>
              <app-status-badge [label]="z.active ? 'ACTIVE' : 'idle'" [tone]="z.active ? 'success' : 'neutral'"></app-status-badge>
            </div>
          </div>
        </section>

        <!-- Filters -->
        <section *ngIf="study.filters" class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <div class="px-4 py-3 border-b border-zinc-800">
            <div class="font-medium">Volume &amp; divergence filters</div>
          </div>
          <div class="p-4 flex flex-wrap gap-3">
            <app-status-badge [label]="study.filters.volumeSpike ? 'VOLUME SPIKE' : 'Volume normal'" [tone]="study.filters.volumeSpike ? 'warning' : 'neutral'"></app-status-badge>
            <app-status-badge
              *ngIf="study.filters.rsiDivergence"
              [label]="'RSI ' + study.filters.rsiDivergence + ' div'"
              tone="warning">
            </app-status-badge>
            <app-status-badge *ngIf="!study.filters.rsiDivergence" label="No RSI divergence" tone="neutral"></app-status-badge>
          </div>
        </section>
      </div>

      <app-empty-state
        *ngIf="!loading && !study"
        message="Could not compute Gann intraday study — check grid data (M15 nyTime, D1)."
        actionLabel="Retry"
        (actionClick)="refresh()">
      </app-empty-state>
    </app-pull-to-refresh>
  `
})
export class GannIntradayComponent implements OnInit, OnDestroy {
  entryTfOptions = ['M5', 'M15'];
  pivotOptions: SessionPivotKey[] = [
    'nyOpen', 'londonOpen', 'pdh', 'pdl', 'prevClose', 'nyHigh', 'nyLow', 'londonHigh', 'londonLow'
  ];

  entryTf = 'M5';
  so9PivotKey: SessionPivotKey = 'nyOpen';
  timeScaleFactor = 1.0;
  extensionThresholdAtr = 1.25;
  showOdd = true;
  showEven = true;

  study: GannIntradayStudy | null = null;
  loading = false;
  offline = false;
  streamConnected = false;
  formatWallTime = formatWallTime;
  private subs = new Subscription();

  constructor(
    private http: HttpClient,
    private marketCache: MarketDataCacheService,
    private gannStream: GannIntradayStreamService
  ) {}

  ngOnInit(): void {
    this.gannStream.start();
    this.subs.add(this.gannStream.connected$.subscribe(c => { this.streamConnected = c; }));
    this.subs.add(this.gannStream.snapshot$.subscribe(s => {
      if (s?.live !== false && s?.angle) {
        this.applyStudy(s as GannIntradayStudy);
      }
    }));
    this.refresh();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  setPivot(key: string): void {
    this.so9PivotKey = key as SessionPivotKey;
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    const params = new HttpParams()
      .set('entry_tf', this.entryTf)
      .set('so9_pivot', this.so9PivotKey)
      .set('time_scale', String(this.timeScaleFactor))
      .set('atr_threshold', String(this.extensionThresholdAtr))
      .set('prefer_live', 'false');

    this.http.get<GannIntradayStudy>(`${environment.apiUrl}/market/xauusd/gann-intraday`, { params }).subscribe({
      next: data => {
        this.loading = false;
        if (data && (data as any).angle) {
          this.applyStudy(data);
          this.gannStream.pushAlertFromStudy(this.study);
        } else {
          this.refreshFromGrid();
        }
      },
      error: () => this.refreshFromGrid()
    });
  }

  private refreshFromGrid(): void {
    forkJoin({
      entry: this.marketCache.fetchGridWithFallback(this.entryTf, 120, false),
      m15: this.marketCache.fetchGridWithFallback('M15', 120, false),
      d1: this.marketCache.fetchGridWithFallback('D1', 30, false)
    }).subscribe({
      next: ({ entry, m15, d1 }) => {
        this.loading = false;
        this.offline = entry.offline || m15.offline || d1.offline;
        const computed = computeGannIntradayStudy(
          this.entryTf,
          entry.rows || [],
          m15.rows || [],
          d1.rows || [],
          {
            so9PivotKey: this.so9PivotKey,
            timeScaleFactor: this.timeScaleFactor,
            extensionThresholdAtr: this.extensionThresholdAtr
          }
        );
        if (computed) {
          this.applyStudy(computed);
          this.gannStream.pushAlertFromStudy(this.study);
        } else {
          this.study = null;
        }
      },
      error: () => {
        this.loading = false;
        this.study = null;
      }
    });
  }

  private applyStudy(raw: GannIntradayStudy): void {
    if (!raw.oddEvenAboveRows?.length) {
      raw.oddEvenAboveRows = buildGannAboveRows(true, true);
      raw.oddEvenBelowRows = buildGannBelowRows(true, true);
    }
    if (raw.fineAbove?.length && !raw.fineAbove[0].kind) {
      raw.fineAbove = raw.fineAbove.map((l: any) => ({
        label: l.label,
        price: l.price,
        angleHint: l.angleHint ?? '45°',
        kind: 'fine' as const
      }));
      raw.fineBelow = raw.fineBelow.map((l: any) => ({
        label: l.label,
        price: l.price,
        angleHint: l.angleHint ?? '45°',
        kind: 'fine' as const
      }));
    }
    if (!raw.filters) {
      raw.filters = { volumeSpike: false, rsiDivergence: '' };
    }
    this.study = raw;
  }

  get aboveOddEvenRows(): GannGridRowDef[] {
    if (!this.study || (!this.showOdd && !this.showEven)) return [];
    return this.study.oddEvenAboveRows.filter(r =>
      (r.kind === 'odd' && this.showOdd) || (r.kind === 'even' && this.showEven)
    );
  }

  get belowOddEvenRows(): GannGridRowDef[] {
    if (!this.study || (!this.showOdd && !this.showEven)) return [];
    return this.study.oddEvenBelowRows.filter(r =>
      (r.kind === 'odd' && this.showOdd) || (r.kind === 'even' && this.showEven)
    );
  }

  oddEvenVal(row: GannGridRowDef): number | null {
    if (!this.study) return null;
    return oddEvenCellValue(this.study.oddEven, row);
  }

  gannRowTextClass(row: GannGridRowDef): string {
    return row.kind === 'odd' ? 'text-violet-300' : 'text-indigo-300';
  }

  gannRowBgClass(row: GannGridRowDef): string {
    return row.kind === 'odd' ? 'bg-violet-950/10' : 'bg-indigo-950/10';
  }

  nearPriceClass(price: number | null): string {
    if (!this.study || price == null) return '';
    const tol = Math.max(this.study.currentPrice * 0.0008, 0.5);
    return Math.abs(price - this.study.currentPrice) <= tol ? 'text-emerald-300 font-semibold' : '';
  }

  pivotLabel(key: SessionPivotKey | string): string {
    const map: Record<string, string> = {
      pdh: 'PDH',
      pdl: 'PDL',
      prevClose: 'Prev close',
      nyOpen: 'NY open',
      nyHigh: 'NY high',
      nyLow: 'NY low',
      londonOpen: 'London open',
      londonHigh: 'London high',
      londonLow: 'London low'
    };
    return map[key] ?? key;
  }

  activeKillzoneLabels(study: GannIntradayStudy): string {
    return study.killzones.filter(z => z.active).map(z => z.label).join(', ');
  }

  biasLabel(study: GannIntradayStudy): string {
    if (study.angle.bias === 'overextended_up') return 'Overextended ↑';
    if (study.angle.bias === 'overextended_down') return 'Overextended ↓';
    return 'Balanced';
  }

  biasTone(study: GannIntradayStudy): 'success' | 'warning' | 'danger' | 'neutral' {
    if (study.angle.bias === 'overextended_up') return 'warning';
    if (study.angle.bias === 'overextended_down') return 'success';
    return 'neutral';
  }

  deviationClass(study: GannIntradayStudy): string {
    if (study.angle.overextended) return 'text-amber-300';
    return 'text-zinc-200';
  }

  severityTone(severity: ReversalSeverity): 'success' | 'warning' | 'danger' | 'neutral' {
    if (severity === 'high') return 'danger';
    if (severity === 'medium') return 'warning';
    if (severity === 'low') return 'neutral';
    return 'neutral';
  }

  alertBannerClass(severity: ReversalSeverity): string {
    if (severity === 'high') return 'border-red-800 bg-red-950/30';
    if (severity === 'medium') return 'border-amber-800 bg-amber-950/25';
    if (severity === 'low') return 'border-zinc-700 bg-zinc-900';
    return 'border-zinc-800 bg-zinc-900/80';
  }
}
