import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { PageHeaderComponent } from '../ui/page-header.component';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { OrderRsiSnapshot, OrderRsiStreamService } from '../services/order-rsi-stream.service';
import { formatWallTime, formatAgeMinutes } from '../utils/time.util';

@Component({
  selector: 'app-order-rsi',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      title="Order RSI"
      subtitle="Live RSI(14) on the forming candle (shift 0) from MT5 — W1 through M1.">
      <div actions>
        <app-status-badge
          [label]="connected ? 'LIVE' : 'OFFLINE'"
          [tone]="connected ? 'success' : 'danger'">
        </app-status-badge>
      </div>
    </app-page-header>

    <div *ngIf="snapshot" class="space-y-4">
      <!-- Headline price + times -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div class="text-[10px] uppercase tracking-wider text-zinc-500">XAUUSD · forming close</div>
            <div class="text-3xl sm:text-4xl font-semibold tabular-nums text-emerald-400 mt-1">
              {{ snapshot.price != null ? (snapshot.price | number:'1.2-2') : '—' }}
            </div>
          </div>
          <div class="text-right text-[10px] text-zinc-500 space-y-1 font-mono">
            <div><span class="text-zinc-600">Broker</span> {{ formatWallTime(snapshot.asOf.broker) }}</div>
            <div><span class="text-zinc-600">NY</span> {{ formatWallTime(snapshot.asOf.ny) }}</div>
            <div><span class="text-zinc-600">IST</span> {{ formatWallTime(snapshot.asOf.ist) }}</div>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-500">
          <span class="px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800">mode: {{ snapshot.pushMode || 'tick' }}</span>
          <span *ngIf="snapshot.updatedAt" class="px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800">
            updated {{ formatAgeMinutes(updatedAgeMinutes) }}
          </span>
        </div>
        <p *ngIf="snapshot.message && !snapshot.live" class="mt-3 text-xs text-amber-300/90">{{ snapshot.message }}</p>
        <p *ngIf="!snapshot.live" class="mt-2 text-[10px] text-zinc-500 font-mono">python run_order_rsi.py</p>
      </div>

      <!-- RSI grid -->
      <div class="grid mobile:grid-cols-2 tablet:grid-cols-3 lg:grid-cols-4 gap-3">
        <div
          *ngFor="let tf of timeframeOrder"
          class="bg-zinc-900 border border-zinc-800 rounded-3xl px-4 py-4 min-h-[6.5rem]"
          [class.border-emerald-700]="rsiTone(tf) === 'success'"
          [class.border-amber-700]="rsiTone(tf) === 'warning'"
          [class.border-red-800]="rsiTone(tf) === 'danger'">
          <div class="flex justify-between items-start gap-2">
            <div class="font-semibold">{{ tf }}</div>
            <app-status-badge
              [label]="rowFor(tf)?.forming ? 'LIVE' : '—'"
              [tone]="rowFor(tf) ? 'success' : 'neutral'">
            </app-status-badge>
          </div>
          <div class="mt-2 text-2xl font-semibold tabular-nums font-mono"
            [class.text-emerald-400]="rsiTone(tf) === 'success'"
            [class.text-amber-400]="rsiTone(tf) === 'warning'"
            [class.text-red-400]="rsiTone(tf) === 'danger'"
            [class.text-zinc-500]="!rowFor(tf)?.rsi">
            {{ rowFor(tf)?.rsi != null ? (rowFor(tf)!.rsi | number:'1.1-1') : '—' }}
          </div>
          <ng-container *ngIf="rowFor(tf)?.time as t">
            <div class="text-[10px] text-zinc-500 mt-1 font-mono">
              bar {{ formatWallTime(t.broker) }} UTC
            </div>
            <div class="text-[10px] text-zinc-600 font-mono">NY {{ formatWallTime(t.ny) }}</div>
          </ng-container>
        </div>
      </div>
    </div>

    <div *ngIf="!snapshot" class="text-center text-zinc-500 text-sm py-12">Connecting to live Order RSI stream…</div>
  `
})
export class OrderRsiComponent implements OnInit, OnDestroy {
  timeframeOrder = ['W1', 'D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
  snapshot: OrderRsiSnapshot | null = null;
  connected = false;
  formatWallTime = formatWallTime;
  formatAgeMinutes = formatAgeMinutes;

  private subs = new Subscription();

  constructor(
    private stream: OrderRsiStreamService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.http.get<OrderRsiSnapshot>(`${environment.apiUrl}/market/xauusd/order-rsi`).subscribe({
      next: data => { this.snapshot = data; },
      error: () => undefined
    });

    this.stream.start();
    this.subs.add(this.stream.snapshot$.subscribe(s => {
      if (s) this.snapshot = s;
    }));
    this.subs.add(this.stream.connected$.subscribe(c => { this.connected = c; }));
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    this.stream.stop();
  }

  get updatedAgeMinutes(): number | null {
    if (!this.snapshot?.updatedAt) return null;
    const t = Date.parse(this.snapshot.updatedAt);
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 60000);
  }

  rowFor(tf: string) {
    return this.snapshot?.timeframes?.[tf];
  }

  rsiTone(tf: string): 'success' | 'warning' | 'danger' | 'neutral' {
    const rsi = this.rowFor(tf)?.rsi;
    if (rsi == null) return 'neutral';
    if (rsi >= 70) return 'danger';
    if (rsi <= 30) return 'success';
    return 'warning';
  }
}
