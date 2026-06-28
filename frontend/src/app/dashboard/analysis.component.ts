import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PageHeaderComponent } from '../ui/page-header.component';
import { SegmentControlComponent } from '../ui/segment-control.component';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { PullToRefreshComponent } from '../ui/pull-to-refresh.component';
import { MarketDataCacheService } from '../services/market-data-cache.service';
import { formatWallTime } from '../utils/time.util';
import { computeGannStudy, GannLevel, GannStudy, nearestGannLevels } from '../utils/gann.util';

interface StormRow {
  time: string;
  rsi: number;
  close: number;
  signal: 'OVERBOUGHT' | 'OVERSOLD';
}

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeaderComponent, SegmentControlComponent, StatusBadgeComponent, EmptyStateComponent, PullToRefreshComponent],
  template: `
    <app-pull-to-refresh #ptr (refresh)="refresh()">
      <app-page-header
        title="Analysis Lab"
        subtitle="RSI storm scanner and Gann level studies for XAUUSD.">
        <div actions>
          <a routerLink="../docs" class="min-h-11 px-4 text-xs font-semibold rounded-2xl border border-zinc-700 active:bg-zinc-900 inline-flex items-center">Read docs</a>
        </div>
        <div toolbar>
          <app-segment-control [options]="modules" [value]="activeModule" ariaLabel="Analysis module" (valueChange)="setModule($event)"></app-segment-control>
          <app-segment-control *ngIf="activeModule === 'rsi'" [options]="timeframes" [value]="selectedTf" ariaLabel="Scan timeframe" (valueChange)="selectedTf = $event; scanRsi()"></app-segment-control>
          <app-segment-control *ngIf="activeModule === 'gann'" [options]="gannTimeframes" [value]="gannTf" ariaLabel="Gann timeframe" (valueChange)="gannTf = $event; scanGann()"></app-segment-control>
          <button type="button" (click)="refresh()" [disabled]="loading" class="mt-3 min-h-11 px-4 text-sm font-semibold rounded-2xl border border-emerald-800 text-emerald-400 active:bg-emerald-950 disabled:opacity-50">
            {{ loading ? 'Running…' : 'Run analysis' }}
          </button>
        </div>
      </app-page-header>

      <div class="grid tablet:grid-cols-2 gap-4 mb-6">
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-5" [ngClass]="{ 'ring-1 ring-emerald-700/50': activeModule === 'rsi' }">
          <div class="font-medium mb-1">RSI Storm Detection</div>
          <p class="text-sm text-zinc-400 leading-relaxed">Flags overbought (≥70) and oversold (≤30) on M15, H1, H4 grid data.</p>
          <app-status-badge class="inline-block mt-3" [label]="activeModule === 'rsi' ? 'Active' : 'Ready'" [tone]="activeModule === 'rsi' ? 'success' : 'neutral'"></app-status-badge>
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-5" [ngClass]="{ 'ring-1 ring-emerald-700/50': activeModule === 'gann' }">
          <div class="font-medium mb-1">Gann Analysis</div>
          <p class="text-sm text-zinc-400 leading-relaxed">Swing octave levels and Square-of-9 projections from recent range.</p>
          <app-status-badge class="inline-block mt-3" [label]="activeModule === 'gann' ? 'Active' : 'Ready'" [tone]="activeModule === 'gann' ? 'success' : 'neutral'"></app-status-badge>
        </div>
      </div>

      <!-- RSI panel -->
      <div *ngIf="activeModule === 'rsi'" class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <div class="px-4 py-3 border-b border-zinc-800 text-xs text-zinc-400 flex justify-between">
          <span>Signals · {{ storms.length }} matches</span>
          <span>Thresholds: RSI ≥ 70 or ≤ 30</span>
        </div>
        <app-empty-state *ngIf="loading" [loading]="true" loadingMessage="Scanning RSI storms…"></app-empty-state>
        <div *ngIf="!loading && storms.length" class="divide-y divide-zinc-800">
          <div *ngFor="let s of storms" class="px-4 py-3 flex flex-wrap items-center justify-between gap-2 active:bg-zinc-800/40">
            <div>
              <div class="font-mono text-xs text-zinc-400">{{ formatWallTime(s.time) }}</div>
              <div class="text-sm font-semibold tabular-nums mt-0.5">Close {{ s.close | number:'1.2-2' }}</div>
            </div>
            <div class="text-right">
              <app-status-badge [label]="s.signal" [tone]="s.signal === 'OVERBOUGHT' ? 'warning' : 'success'"></app-status-badge>
              <div class="text-xs font-mono text-zinc-300 mt-1">RSI {{ s.rsi | number:'1.1-1' }}</div>
            </div>
          </div>
        </div>
        <app-empty-state *ngIf="!loading && !storms.length" message="No RSI storm signals in the latest {{ selectedTf }} sample." actionLabel="Scan again" (actionClick)="scanRsi()"></app-empty-state>
      </div>

      <!-- Gann panel -->
      <div *ngIf="activeModule === 'gann'" class="space-y-4">
        <div *ngIf="gannStudy && !loading" class="grid mobile:grid-cols-3 gap-3">
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase tracking-wider">Swing high</div>
            <div class="text-lg font-semibold tabular-nums mt-1">{{ gannStudy.swingHigh | number:'1.2-2' }}</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase tracking-wider">Pivot (50%)</div>
            <div class="text-lg font-semibold tabular-nums mt-1 text-emerald-400">{{ gannStudy.pivot | number:'1.2-2' }}</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div class="text-[10px] text-zinc-500 uppercase tracking-wider">Swing low</div>
            <div class="text-lg font-semibold tabular-nums mt-1">{{ gannStudy.swingLow | number:'1.2-2' }}</div>
          </div>
        </div>

        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <div class="px-4 py-3 border-b border-zinc-800 text-xs text-zinc-400 flex flex-wrap justify-between gap-2">
            <span>Gann levels · {{ gannTf }} · last close {{ gannStudy?.lastClose | number:'1.2-2' }}</span>
            <span>Nearest levels highlighted</span>
          </div>
          <app-empty-state *ngIf="loading" [loading]="true" loadingMessage="Computing Gann study…"></app-empty-state>
          <div *ngIf="!loading && gannStudy" class="divide-y divide-zinc-800">
            <div
              *ngFor="let level of gannStudy.levels"
              class="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
              [ngClass]="{ 'bg-emerald-950/20': isNearest(level) }">
              <div>
                <div class="text-sm font-medium">{{ level.label }}</div>
                <div class="text-[10px] text-zinc-500 mt-0.5 capitalize">{{ level.kind }}</div>
              </div>
              <div class="text-right">
                <div class="font-mono text-sm tabular-nums">{{ level.price | number:'1.2-2' }}</div>
                <div *ngIf="gannStudy" class="text-[10px] text-zinc-500 mt-0.5">
                  Δ {{ (level.price - gannStudy.lastClose) | number:'1.2-2' }}
                </div>
              </div>
            </div>
          </div>
          <app-empty-state *ngIf="!loading && !gannStudy" message="Not enough {{ gannTf }} data for Gann study." actionLabel="Retry" (actionClick)="scanGann()"></app-empty-state>
        </div>
      </div>
    </app-pull-to-refresh>
  `
})
export class AnalysisComponent implements OnInit {
  modules = ['rsi', 'gann'];
  activeModule = 'rsi';
  timeframes = ['M15', 'H1', 'H4'];
  gannTimeframes = ['D1', 'H4', 'H1'];
  selectedTf = 'M15';
  gannTf = 'D1';
  storms: StormRow[] = [];
  gannStudy: GannStudy | null = null;
  nearestLevels: GannLevel[] = [];
  loading = false;
  formatWallTime = formatWallTime;

  constructor(private marketCache: MarketDataCacheService) {}

  ngOnInit() {
    this.refresh();
  }

  setModule(module: string) {
    this.activeModule = module;
    this.refresh();
  }

  refresh() {
    if (this.activeModule === 'gann') {
      this.scanGann();
    } else {
      this.scanRsi();
    }
  }

  scanRsi() {
    this.loading = true;
    this.marketCache.fetchGridWithFallback(this.selectedTf, 120, false).subscribe({
      next: result => {
        this.loading = false;
        const rows = result.rows || [];
        this.storms = rows
          .filter(r => r.rsi != null && (r.rsi >= 70 || r.rsi <= 30))
          .map(r => ({
            time: r.time,
            rsi: r.rsi,
            close: r.close,
            signal: r.rsi >= 70 ? 'OVERBOUGHT' as const : 'OVERSOLD' as const
          }))
          .slice(0, 30);
      },
      error: () => {
        this.loading = false;
        this.storms = [];
      }
    });
  }

  scanGann() {
    this.loading = true;
    const limit = this.gannTf === 'D1' ? 120 : 120;
    this.marketCache.fetchGridWithFallback(this.gannTf, limit, false).subscribe({
      next: result => {
        this.loading = false;
        this.gannStudy = computeGannStudy(result.rows || [], this.gannTf === 'D1' ? 90 : 60);
        this.nearestLevels = this.gannStudy ? nearestGannLevels(this.gannStudy, 4) : [];
      },
      error: () => {
        this.loading = false;
        this.gannStudy = null;
        this.nearestLevels = [];
      }
    });
  }

  isNearest(level: GannLevel): boolean {
    return this.nearestLevels.some(n => n.label === level.label && n.price === level.price);
  }
}
