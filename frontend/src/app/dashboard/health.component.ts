import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { PageHeaderComponent } from '../ui/page-header.component';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { TimeframeContextService } from '../services/timeframe-context.service';

@Component({
  selector: 'app-health',
  standalone: true,
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
        <span class="text-xs text-zinc-400">{{ health.freshCount || 0 }} / {{ health.total || 6 }} fresh</span>
        <span class="text-xs text-zinc-500 w-full sm:w-auto sm:ml-auto">Checked: {{ health.checkedAt | date:'MMM dd HH:mm' }}</span>
      </div>
      <div *ngIf="health.status !== 'UP'" class="mt-3 flex flex-wrap gap-2">
        <button type="button" (click)="copyDownloaderCmd()" class="min-h-11 px-3 text-xs rounded-2xl border border-amber-800 text-amber-300 active:bg-amber-950">Copy downloader cmd</button>
        <a [routerLink]="['../market']" class="min-h-11 px-3 text-xs rounded-2xl border border-zinc-700 active:bg-zinc-900 inline-flex items-center">Open Market</a>
      </div>
    </div>

    <div class="grid grid-cols-2 tablet:grid-cols-3 lg:grid-cols-6 gap-3">
      <button type="button" *ngFor="let tf of timeframes" (click)="expandedTf = expandedTf === tf ? null : tf"
        class="text-left bg-zinc-900 border border-zinc-800 rounded-3xl px-4 py-4 text-sm min-h-[5.5rem] active:bg-zinc-800/80"
        [class.border-emerald-700]="isFresh(tf)" [class.border-amber-700]="!isFresh(tf) && getDetail(tf)"
        [attr.aria-expanded]="expandedTf === tf">
        <div class="flex justify-between items-start gap-2">
          <div class="font-semibold">{{ tf }}</div>
          <app-status-badge
            [label]="isFresh(tf) ? 'FRESH' : (getDetail(tf) ? 'STALE' : 'NO DATA')"
            [tone]="isFresh(tf) ? 'success' : (getDetail(tf) ? 'warning' : 'neutral')">
          </app-status-badge>
        </div>
        <div class="mt-2 font-mono text-xs text-zinc-300" *ngIf="getDetail(tf)?.lastCandleTime as t">Last: {{ t | date:'MMM dd HH:mm' }}</div>
        <div class="text-[10px] text-zinc-500" *ngIf="getDetail(tf)?.lastSynced as s">Synced: {{ s | date:'MMM dd HH:mm' }}</div>
        <div *ngIf="expandedTf === tf" class="mt-3 space-y-2 border-t border-zinc-800 pt-2">
          <p class="text-[10px] text-zinc-500 leading-relaxed">Run MT5 logged in, then: <span class="font-mono text-zinc-400">python run_data_downloader.py</span></p>
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
  timeframes = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
  health: any = null;
  expandedTf: string | null = null;

  constructor(
    private http: HttpClient,
    private timeframeContext: TimeframeContextService
  ) {}

  ngOnInit() {
    this.loadHealth();
  }

  loadHealth() {
    this.http.get<any>(`${environment.apiUrl}/market/xauusd/health`).subscribe({
      next: data => { this.health = data || {}; },
      error: () => { this.health = { status: 'DOWN', details: {} }; }
    });
  }

  getDetail(tf: string) {
    return this.health?.details?.[tf];
  }

  isFresh(tf: string): boolean {
    const d = this.getDetail(tf);
    return !!d && d.fresh === true;
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
