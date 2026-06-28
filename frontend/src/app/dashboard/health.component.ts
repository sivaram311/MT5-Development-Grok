import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { PageHeaderComponent } from '../ui/page-header.component';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { TimeframeContextService } from '../services/timeframe-context.service';
import { formatBrokerTime, formatAgeMinutes } from '../utils/time.util';

@Component({
  selector: 'app-health',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      title="Pipeline Health"
      subtitle="Per-timeframe freshness for completed XAUUSD candles synced from MT5.">
      <div actions>
        <button type="button" (click)="loadHealth()" class="min-h-11 text-xs px-4 border border-zinc-700 active:bg-zinc-900 rounded-2xl font-semibold">Refresh</button>
      </div>
    </app-page-header>

    <div *ngIf="health" class="mb-5 p-4 bg-zinc-900 border border-zinc-800 rounded-3xl">
      <div class="flex flex-wrap items-center gap-3">
        <app-status-badge [label]="health.status" [tone]="statusTone(health.status)"></app-status-badge>
        <app-status-badge
          *ngIf="health.pipelineLive"
          label="PIPELINE LIVE"
          tone="success">
        </app-status-badge>
        <span class="text-xs text-zinc-400">{{ health.freshCount || 0 }} / {{ health.total || 6 }} fresh</span>
        <span class="text-xs text-zinc-500 w-full sm:w-auto sm:ml-auto">Checked: {{ formatBrokerTime(health.checkedAt) }}</span>
      </div>
      <p *ngIf="health.message" class="text-xs text-zinc-400 mt-3 leading-relaxed">{{ health.message }}</p>
      <div *ngIf="!health.pipelineLive" class="mt-3 flex flex-wrap gap-2">
        <button type="button" (click)="copyDownloaderCmd()" class="min-h-11 px-3 text-xs rounded-2xl border border-amber-800 text-amber-300 active:bg-amber-950">Copy downloader cmd</button>
        <a [routerLink]="['../market']" class="min-h-11 px-3 text-xs rounded-2xl border border-zinc-700 active:bg-zinc-900 inline-flex items-center">Open Market</a>
      </div>
    </div>

    <div class="grid grid-cols-2 tablet:grid-cols-3 lg:grid-cols-6 gap-3">
      <button type="button" *ngFor="let tf of timeframes" (click)="expandedTf = expandedTf === tf ? null : tf"
        class="text-left bg-zinc-900 border border-zinc-800 rounded-3xl px-4 py-4 text-sm min-h-[5.5rem] active:bg-zinc-800/80"
        [class.border-emerald-700]="isFresh(tf)"
        [class.border-amber-700]="!isFresh(tf) && getDetail(tf)?.lastCandleTime"
        [attr.aria-expanded]="expandedTf === tf">
        <div class="flex justify-between items-start gap-2">
          <div class="font-semibold">{{ tf }}</div>
          <app-status-badge
            [label]="cardLabel(tf)"
            [tone]="cardTone(tf)">
          </app-status-badge>
        </div>
        <div class="mt-2 font-mono text-xs text-zinc-300" *ngIf="getDetail(tf)?.lastCandleTime as t">
          Last: {{ formatBrokerTime(t) }} <span class="text-zinc-500">UTC</span>
        </div>
        <div class="text-[10px] text-zinc-500" *ngIf="getDetail(tf)?.ageMinutes != null">
          Age: {{ formatAgeMinutes(getDetail(tf)?.ageMinutes) }} · threshold &lt; {{ getDetail(tf)?.thresholdMinutes }}m
        </div>
        <div class="text-[10px] text-zinc-500" *ngIf="getDetail(tf)?.lastSynced as s">
          Synced: {{ formatBrokerTime(s) }}
        </div>
        <div *ngIf="expandedTf === tf" class="mt-3 space-y-2 border-t border-zinc-800 pt-2">
          <p class="text-[10px] text-zinc-500 leading-relaxed" *ngIf="!health?.pipelineLive">
            Run MT5 logged in, then: <span class="font-mono text-zinc-400">python run_data_downloader.py</span>
          </p>
          <p class="text-[10px] text-zinc-500 leading-relaxed" *ngIf="health?.pipelineLive && !isFresh(tf)">
            Downloader is running. Stale candles usually mean the market is closed or MT5 has no newer completed bars yet.
          </p>
          <div class="flex flex-wrap gap-2">
            <button type="button" (click)="copyDownloaderCmd(); $event.stopPropagation()" class="min-h-9 px-2 text-[10px] rounded-xl border border-zinc-700">Copy cmd</button>
            <a [routerLink]="['../market']" (click)="setGlobalTf(tf); $event.stopPropagation()" class="min-h-9 px-2 text-[10px] rounded-xl border border-zinc-700 inline-flex items-center">Market {{ tf }}</a>
          </div>
        </div>
      </button>
    </div>
  `
})
export class HealthComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  timeframes = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
  health: any = null;
  expandedTf: string | null = null;
  formatBrokerTime = formatBrokerTime;
  formatAgeMinutes = formatAgeMinutes;

  constructor(
    private http: HttpClient,
    private timeframeContext: TimeframeContextService
  ) {}

  ngOnInit() {
    this.loadHealth();
  }

  loadHealth() {
    this.http.get<any>(`${environment.apiUrl}/market/xauusd/health`).subscribe({
      next: data => {
        this.health = data || {};
        this.cdr.markForCheck();
      },
      error: () => {
        this.health = { status: 'DOWN', details: {}, message: 'Could not reach health API' };
        this.cdr.markForCheck();
      }
    });
  }

  getDetail(tf: string) {
    return this.health?.details?.[tf];
  }

  isFresh(tf: string): boolean {
    const d = this.getDetail(tf);
    return !!d && d.fresh === true;
  }

  cardLabel(tf: string): string {
    const d = this.getDetail(tf);
    if (!d?.lastCandleTime) return 'NO DATA';
    if (d.fresh) return 'FRESH';
    return this.health?.pipelineLive ? 'STALE' : 'OFFLINE';
  }

  cardTone(tf: string): 'success' | 'warning' | 'danger' | 'neutral' {
    const d = this.getDetail(tf);
    if (!d?.lastCandleTime) return 'neutral';
    if (d.fresh) return 'success';
    return this.health?.pipelineLive ? 'warning' : 'danger';
  }

  statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'UP') return 'success';
    if (status === 'DEGRADED') return 'warning';
    if (status === 'DOWN') return 'danger';
    return 'neutral';
  }

  copyDownloaderCmd() {
    navigator.clipboard?.writeText('python run_data_downloader.py').catch(() => undefined);
  }

  setGlobalTf(tf: string) {
    this.timeframeContext.setTimeframe(tf);
  }
}
