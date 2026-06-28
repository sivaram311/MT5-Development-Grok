import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { PageHeaderComponent } from '../ui/page-header.component';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import {
  GannOddSquareBlock,
  OrderRsiSnapshot,
  OrderRsiSourceMode,
  OrderRsiSrLevelKey,
  OrderRsiStreamService,
  OrderRsiTfRow
} from '../services/order-rsi-stream.service';
import { formatWallTime, formatAgeMinutes } from '../utils/time.util';
import { orderRsiZone, orderRsiZoneBoxClass } from '../utils/order-rsi-zone.util';

type OrderRsiRowKey = 'bar0Rsi' | 'bar0Data' | 'bar1Rsi' | 'bar1Data' | 'b0sr' | 'b1sr';

interface OrderRsiRowDef {
  key: OrderRsiRowKey;
  label: string;
}

interface SrRowDef {
  level: OrderRsiSrLevelKey;
  label: string;
}

type GannGridId = 'bar1' | 'bar0';
type GannToggleKey = 'gannOdd' | 'gannEven';

interface GannBandRowDef {
  label: string;
  direction: 'above' | 'below';
  index: number;
}

@Component({
  selector: 'app-order-rsi',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      title="Analyzer"
      subtitle="RSI · classic S/R pivots · Gann Odd Square — timeframes as columns.">
      <div actions class="flex flex-wrap items-center gap-2">
        <app-status-badge
          [label]="connected ? 'LIVE' : 'OFFLINE'"
          [tone]="connected ? 'success' : 'danger'">
        </app-status-badge>
      </div>
    </app-page-header>

    <div *ngIf="snapshot" class="space-y-4">
      <!-- RSI source -->
      <div class="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
        <div class="text-xs text-zinc-500">
          RSI source
          <span class="block text-[10px] text-zinc-600 mt-0.5">Page only — not saved</span>
        </div>
        <div class="flex rounded-xl border border-zinc-700 overflow-hidden text-xs font-medium">
          <button
            type="button"
            class="px-3 py-2 transition-colors"
            [class.bg-zinc-700]="rsiSourceMode === 'python_wilder'"
            [class.text-zinc-100]="rsiSourceMode === 'python_wilder'"
            [class.text-zinc-500]="rsiSourceMode !== 'python_wilder'"
            (click)="setRsiSource('python_wilder')">
            Calculated
          </button>
          <button
            type="button"
            class="px-3 py-2 border-l border-zinc-700 transition-colors"
            [class.bg-zinc-700]="rsiSourceMode === 'mt5_iRSI'"
            [class.text-zinc-100]="rsiSourceMode === 'mt5_iRSI'"
            [class.text-zinc-500]="rsiSourceMode !== 'mt5_iRSI'"
            (click)="setRsiSource('mt5_iRSI')">
            MT5 built-in
          </button>
        </div>
      </div>

      <p *ngIf="rsiSourceMode === 'mt5_iRSI' && !mt5Available" class="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-2">
        MT5 export not available — attach <span class="font-mono">GrokDevOrderRsiExport</span> on XAUUSD and enable Algo Trading.
      </p>

      <!-- Row visibility -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
        <div class="text-xs text-zinc-500 mb-2">Show rows</div>
        <div class="flex flex-wrap gap-2">
          <button
            *ngFor="let row of rowDefs"
            type="button"
            class="text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors"
            [ngClass]="rowVisibility[row.key]
              ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
              : 'border-zinc-700 bg-zinc-950 text-zinc-500'"
            (click)="toggleRow(row.key)">
            {{ row.label }}
          </button>
        </div>
      </div>

      <!-- Price strip -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-[10px] uppercase tracking-wider text-zinc-500">XAUUSD</div>
          <div class="text-2xl font-semibold tabular-nums text-zinc-100">
            {{ snapshot.price != null ? (snapshot.price | number:'1.2-2') : '—' }}
          </div>
        </div>
        <div class="text-[10px] text-zinc-500 font-mono text-right">
          <div>updated {{ formatAgeMinutes(updatedAgeMinutes) }}</div>
          <div class="text-zinc-600">{{ rsiSourceMode === 'mt5_iRSI' ? 'MT5 iRSI' : 'Python Wilder' }}</div>
        </div>
      </div>

      <!-- Zone legend -->
      <div class="flex flex-wrap gap-2 text-[10px] text-zinc-500">
        <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-800">
          <span class="w-3 h-3 rounded bg-red-950 border border-red-600/70"></span> &lt; 40
        </span>
        <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-800">
          <span class="w-3 h-3 rounded bg-amber-950 border border-amber-600/60"></span> 40–44 / 56–60
        </span>
        <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-800">
          <span class="w-3 h-3 rounded bg-zinc-800 border border-zinc-700"></span> 45–55
        </span>
        <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-800">
          <span class="w-3 h-3 rounded bg-emerald-950 border border-emerald-600/70"></span> &gt; 60
        </span>
      </div>

      <!-- Table: TF headers as columns -->
      <div class="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
        <table class="w-full min-w-[36rem] text-sm border-collapse">
          <thead>
            <tr class="border-b border-zinc-800 bg-zinc-950/60">
              <th class="sticky left-0 z-10 bg-zinc-950 text-left text-[10px] uppercase tracking-wider text-zinc-500 font-medium px-3 py-2.5 min-w-[5.5rem]">
                Row
              </th>
              <th
                *ngFor="let tf of timeframeOrder"
                class="text-center text-xs font-semibold text-zinc-200 px-2 py-2.5 min-w-[3.25rem]">
                {{ tf }}
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Row 1: Bar 0 forming RSI -->
            <tr *ngIf="rowVisibility.bar0Rsi" class="border-b border-zinc-800/80">
              <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                <span class="font-medium text-zinc-300">Bar 0</span>
                <span class="block text-[9px] text-zinc-600">forming · RSI</span>
              </th>
              <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                <div
                  class="inline-flex min-w-[3.25rem] justify-center items-center px-2 py-1.5 rounded-lg border tabular-nums font-mono font-semibold text-zinc-100 text-sm"
                  [ngClass]="zoneBoxClass(bar0Rsi(tf))">
                  {{ bar0Rsi(tf) != null ? (bar0Rsi(tf)! | number:'1.1-1') : '—' }}
                </div>
              </td>
            </tr>

            <!-- Row 2: Bar 0 data -->
            <tr *ngIf="rowVisibility.bar0Data" class="border-b border-zinc-800/80 bg-zinc-950/20">
              <th class="sticky left-0 z-10 bg-zinc-950 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                <span class="font-medium text-zinc-400">Bar 0</span>
                <span class="block text-[9px] text-zinc-600">data</span>
              </th>
              <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2 text-[10px] font-mono text-zinc-500 leading-snug">
                <div *ngIf="rowFor(tf)?.time">{{ formatWallTime(rowFor(tf)!.time.broker) }}</div>
                <div *ngIf="bar0Close(tf) != null" class="text-zinc-600">{{ bar0Close(tf) | number:'1.2-2' }}</div>
                <span *ngIf="!rowFor(tf)?.time && bar0Close(tf) == null">—</span>
              </td>
            </tr>

            <!-- Bar 0 classic S/R -->
            <ng-container *ngIf="rowVisibility.b0sr">
              <tr
                *ngFor="let sr of srRowDefs"
                class="border-b border-zinc-800/80"
                [ngClass]="srRowBgClass(sr.level)">
                <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                  <span class="font-medium" [ngClass]="srLevelClass(sr.level)">{{ sr.label }}</span>
                  <span class="block text-[9px] text-zinc-600">B0 · SR</span>
                </th>
                <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                  <span class="tabular-nums font-mono text-xs" [ngClass]="srLevelClass(sr.level)">
                    {{ srLevel(tf, 'bar0', sr.level) != null ? (srLevel(tf, 'bar0', sr.level)! | number:'1.2-2') : '—' }}
                  </span>
                </td>
              </tr>
            </ng-container>

            <!-- Row 3: Bar 1 closed RSI -->
            <tr *ngIf="rowVisibility.bar1Rsi" class="border-b border-zinc-800/80">
              <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                <span class="font-medium text-zinc-300">Bar 1</span>
                <span class="block text-[9px] text-zinc-600">closed · RSI</span>
              </th>
              <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                <div
                  class="inline-flex min-w-[3.25rem] justify-center items-center px-2 py-1.5 rounded-lg border tabular-nums font-mono font-semibold text-zinc-100 text-sm"
                  [ngClass]="zoneBoxClass(bar1Rsi(tf))">
                  {{ bar1Rsi(tf) != null ? (bar1Rsi(tf)! | number:'1.1-1') : '—' }}
                </div>
              </td>
            </tr>

            <!-- Row 4: Bar 1 data -->
            <tr *ngIf="rowVisibility.bar1Data" class="border-b border-zinc-800/80 bg-zinc-950/20">
              <th class="sticky left-0 z-10 bg-zinc-950 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                <span class="font-medium text-zinc-400">Bar 1</span>
                <span class="block text-[9px] text-zinc-600">data</span>
              </th>
              <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2 text-[10px] font-mono text-zinc-500 leading-snug">
                <div *ngIf="rowFor(tf)?.completed?.time">{{ formatWallTime(rowFor(tf)!.completed!.time.broker) }}</div>
                <div *ngIf="bar1Close(tf) != null" class="text-zinc-600">{{ bar1Close(tf) | number:'1.2-2' }}</div>
                <span *ngIf="!rowFor(tf)?.completed?.time && bar1Close(tf) == null">—</span>
              </td>
            </tr>

            <!-- Bar 1 classic S/R -->
            <ng-container *ngIf="rowVisibility.b1sr">
              <tr
                *ngFor="let sr of srRowDefs"
                class="border-b border-zinc-800/80 last:border-b-0"
                [ngClass]="srRowBgClass(sr.level)">
                <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                  <span class="font-medium" [ngClass]="srLevelClass(sr.level)">{{ sr.label }}</span>
                  <span class="block text-[9px] text-zinc-600">B1 · SR</span>
                </th>
                <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                  <span class="tabular-nums font-mono text-xs" [ngClass]="srLevelClass(sr.level)">
                    {{ srLevel(tf, 'bar1', sr.level) != null ? (srLevel(tf, 'bar1', sr.level)! | number:'1.2-2') : '—' }}
                  </span>
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </div>

      <!-- Gann · Bar 1 Close -->
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-zinc-200">Gann Odd Square · Bar 1 Close</h2>
            <p class="text-[10px] text-zinc-500 mt-0.5">Pivot = last closed bar close · odd (√P ± 2n)² · even (√P ± (2n±1))²</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              *ngFor="let g of gannToggleDefs"
              type="button"
              class="text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors"
              [ngClass]="gannBar1Visibility[g.key]
                ? 'border-violet-700 bg-violet-950/40 text-violet-300'
                : 'border-zinc-700 bg-zinc-950 text-zinc-500'"
              (click)="toggleGann('bar1', g.key)">
              {{ g.label }}
            </button>
          </div>
        </div>
        <div class="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
          <table class="w-full min-w-[36rem] text-sm border-collapse">
            <thead>
              <tr class="border-b border-zinc-800 bg-zinc-950/60">
                <th class="sticky left-0 z-10 bg-zinc-950 text-left text-[10px] uppercase tracking-wider text-zinc-500 font-medium px-3 py-2.5 min-w-[5.5rem]">Level</th>
                <th *ngFor="let tf of timeframeOrder" class="text-center text-xs font-semibold text-zinc-200 px-2 py-2.5 min-w-[3.25rem]">{{ tf }}</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngIf="gannBar1Visibility.gannOdd">
                <tr *ngFor="let row of gannOddBandRows" class="border-b border-zinc-800/80 bg-violet-950/10">
                  <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                    <span class="font-medium text-violet-300">{{ row.label }}</span>
                    <span class="block text-[9px] text-zinc-600">odd square</span>
                  </th>
                  <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                    <span class="tabular-nums font-mono text-xs" [ngClass]="gannCellClass('bar1', tf, gannOddBandValue('bar1', tf, row), 'odd')">
                      {{ gannOddBandValue('bar1', tf, row) != null ? (gannOddBandValue('bar1', tf, row)! | number:'1.2-2') : '—' }}
                    </span>
                  </td>
                </tr>
              </ng-container>
              <tr *ngIf="showGannPivot('bar1')" class="border-b border-zinc-800/80 bg-amber-950/10">
                <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                  <span class="font-medium text-amber-300">Pivot</span>
                  <span class="block text-[9px] text-zinc-600">Bar 1 close</span>
                </th>
                <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                  <span class="tabular-nums font-mono text-xs text-amber-300">
                    {{ gannPivotValue('bar1', tf) != null ? (gannPivotValue('bar1', tf)! | number:'1.2-2') : '—' }}
                  </span>
                </td>
              </tr>
              <ng-container *ngIf="gannBar1Visibility.gannOdd">
                <tr *ngFor="let row of gannOddBandRowsBelow" class="border-b border-zinc-800/80 bg-violet-950/10">
                  <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                    <span class="font-medium text-violet-300">{{ row.label }}</span>
                    <span class="block text-[9px] text-zinc-600">odd square</span>
                  </th>
                  <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                    <span class="tabular-nums font-mono text-xs" [ngClass]="gannCellClass('bar1', tf, gannOddBandValue('bar1', tf, row), 'odd')">
                      {{ gannOddBandValue('bar1', tf, row) != null ? (gannOddBandValue('bar1', tf, row)! | number:'1.2-2') : '—' }}
                    </span>
                  </td>
                </tr>
              </ng-container>
              <ng-container *ngIf="gannBar1Visibility.gannEven">
                <tr *ngFor="let row of gannEvenBandRows" class="border-b border-zinc-800/80 bg-indigo-950/10" [class.last:border-b-0]="!gannBar1Visibility.gannOdd">
                  <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                    <span class="font-medium text-indigo-300">{{ row.label }}</span>
                    <span class="block text-[9px] text-zinc-600">even square</span>
                  </th>
                  <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                    <span class="tabular-nums font-mono text-xs" [ngClass]="gannCellClass('bar1', tf, gannEvenBandValue('bar1', tf, row), 'even')">
                      {{ gannEvenBandValue('bar1', tf, row) != null ? (gannEvenBandValue('bar1', tf, row)! | number:'1.2-2') : '—' }}
                    </span>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Gann · Bar 0 Open -->
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-zinc-200">Gann Odd Square · Bar 0 Open</h2>
            <p class="text-[10px] text-zinc-500 mt-0.5">Pivot = forming bar open · separate toggles from Bar 1 grid</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              *ngFor="let g of gannToggleDefs"
              type="button"
              class="text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors"
              [ngClass]="gannBar0Visibility[g.key]
                ? 'border-violet-700 bg-violet-950/40 text-violet-300'
                : 'border-zinc-700 bg-zinc-950 text-zinc-500'"
              (click)="toggleGann('bar0', g.key)">
              {{ g.label }}
            </button>
          </div>
        </div>

        <p *ngIf="gannBar0GridUnavailable" class="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-2">
          Bar 0 open not available — restart <span class="font-mono">python-order-rsi</span> after update, or wait for forming-bar data from MT5.
        </p>

        <div class="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
          <table class="w-full min-w-[36rem] text-sm border-collapse">
            <thead>
              <tr class="border-b border-zinc-800 bg-zinc-950/60">
                <th class="sticky left-0 z-10 bg-zinc-950 text-left text-[10px] uppercase tracking-wider text-zinc-500 font-medium px-3 py-2.5 min-w-[5.5rem]">Level</th>
                <th *ngFor="let tf of timeframeOrder" class="text-center text-xs font-semibold text-zinc-200 px-2 py-2.5 min-w-[3.25rem]">{{ tf }}</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngIf="gannBar0Visibility.gannOdd">
                <tr *ngFor="let row of gannOddBandRows" class="border-b border-zinc-800/80 bg-violet-950/10">
                  <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                    <span class="font-medium text-violet-300">{{ row.label }}</span>
                    <span class="block text-[9px] text-zinc-600">odd square</span>
                  </th>
                  <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                    <span class="tabular-nums font-mono text-xs" [ngClass]="gannCellClass('bar0', tf, gannOddBandValue('bar0', tf, row), 'odd')">
                      {{ gannAvailable('bar0', tf) && gannOddBandValue('bar0', tf, row) != null ? (gannOddBandValue('bar0', tf, row)! | number:'1.2-2') : '—' }}
                    </span>
                  </td>
                </tr>
              </ng-container>
              <tr *ngIf="showGannPivot('bar0')" class="border-b border-zinc-800/80 bg-amber-950/10">
                <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                  <span class="font-medium text-amber-300">Pivot</span>
                  <span class="block text-[9px] text-zinc-600">Bar 0 open</span>
                </th>
                <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                  <span class="tabular-nums font-mono text-xs text-amber-300">
                    {{ gannAvailable('bar0', tf) && gannPivotValue('bar0', tf) != null ? (gannPivotValue('bar0', tf)! | number:'1.2-2') : '—' }}
                  </span>
                </td>
              </tr>
              <ng-container *ngIf="gannBar0Visibility.gannOdd">
                <tr *ngFor="let row of gannOddBandRowsBelow" class="border-b border-zinc-800/80 bg-violet-950/10">
                  <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                    <span class="font-medium text-violet-300">{{ row.label }}</span>
                    <span class="block text-[9px] text-zinc-600">odd square</span>
                  </th>
                  <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                    <span class="tabular-nums font-mono text-xs" [ngClass]="gannCellClass('bar0', tf, gannOddBandValue('bar0', tf, row), 'odd')">
                      {{ gannAvailable('bar0', tf) && gannOddBandValue('bar0', tf, row) != null ? (gannOddBandValue('bar0', tf, row)! | number:'1.2-2') : '—' }}
                    </span>
                  </td>
                </tr>
              </ng-container>
              <ng-container *ngIf="gannBar0Visibility.gannEven">
                <tr *ngFor="let row of gannEvenBandRows" class="border-b border-zinc-800/80 bg-indigo-950/10 last:border-b-0">
                  <th class="sticky left-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500 font-normal px-3 py-2 align-middle border-r border-zinc-800/50">
                    <span class="font-medium text-indigo-300">{{ row.label }}</span>
                    <span class="block text-[9px] text-zinc-600">even square</span>
                  </th>
                  <td *ngFor="let tf of timeframeOrder" class="text-center px-2 py-2">
                    <span class="tabular-nums font-mono text-xs" [ngClass]="gannCellClass('bar0', tf, gannEvenBandValue('bar0', tf, row), 'even')">
                      {{ gannAvailable('bar0', tf) && gannEvenBandValue('bar0', tf, row) != null ? (gannEvenBandValue('bar0', tf, row)! | number:'1.2-2') : '—' }}
                    </span>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>

      <p *ngIf="snapshot.message && !snapshot.live" class="text-xs text-amber-300/90">{{ snapshot.message }}</p>
    </div>

    <div *ngIf="!snapshot" class="text-center text-zinc-500 text-sm py-12">Connecting to live Order RSI stream…</div>
  `
})
export class OrderRsiComponent implements OnInit, OnDestroy {
  timeframeOrder = ['W1', 'D1', 'H4', 'H1', 'M15', 'M5', 'M1'];

  rowDefs: OrderRsiRowDef[] = [
    { key: 'bar0Rsi', label: 'Bar 0 · RSI' },
    { key: 'bar0Data', label: 'Bar 0 · data' },
    { key: 'b0sr', label: 'B0SR' },
    { key: 'bar1Rsi', label: 'Bar 1 · RSI' },
    { key: 'bar1Data', label: 'Bar 1 · data' },
    { key: 'b1sr', label: 'B1SR' }
  ];

  srRowDefs: SrRowDef[] = [
    { level: 's3', label: 'S3' },
    { level: 's2', label: 'S2' },
    { level: 's1', label: 'S1' },
    { level: 'pivot', label: 'Pivot' },
    { level: 'r1', label: 'R1' },
    { level: 'r2', label: 'R2' },
    { level: 'r3', label: 'R3' }
  ];

  rowVisibility: Record<OrderRsiRowKey, boolean> = {
    bar0Rsi: true,
    bar0Data: true,
    b0sr: true,
    bar1Rsi: true,
    bar1Data: true,
    b1sr: true
  };

  gannToggleDefs: { key: GannToggleKey; label: string }[] = [
    { key: 'gannOdd', label: 'Odd Sq' },
    { key: 'gannEven', label: 'Even Sq' }
  ];

  gannBar1Visibility: Record<GannToggleKey, boolean> = {
    gannOdd: true,
    gannEven: false
  };

  gannBar0Visibility: Record<GannToggleKey, boolean> = {
    gannOdd: true,
    gannEven: false
  };

  gannOddBandRows: GannBandRowDef[] = [
    { label: 'OS↑3', direction: 'above', index: 2 },
    { label: 'OS↑2', direction: 'above', index: 1 },
    { label: 'OS↑1', direction: 'above', index: 0 }
  ];

  gannOddBandRowsBelow: GannBandRowDef[] = [
    { label: 'OS↓1', direction: 'below', index: 0 },
    { label: 'OS↓2', direction: 'below', index: 1 },
    { label: 'OS↓3', direction: 'below', index: 2 }
  ];

  gannEvenBandRows: GannBandRowDef[] = [
    { label: 'ES↑3', direction: 'above', index: 2 },
    { label: 'ES↑2', direction: 'above', index: 1 },
    { label: 'ES↑1', direction: 'above', index: 0 },
    { label: 'ES↓1', direction: 'below', index: 0 },
    { label: 'ES↓2', direction: 'below', index: 1 },
    { label: 'ES↓3', direction: 'below', index: 2 }
  ];

  snapshot: OrderRsiSnapshot | null = null;
  connected = false;
  rsiSourceMode: OrderRsiSourceMode = 'python_wilder';
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

  get mt5Available(): boolean {
    return this.snapshot?.mt5ExportAvailable === true;
  }

  get updatedAgeMinutes(): number | null {
    if (!this.snapshot?.updatedAt) return null;
    const t = Date.parse(this.snapshot.updatedAt);
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 60000);
  }

  setRsiSource(mode: OrderRsiSourceMode): void {
    this.rsiSourceMode = mode;
  }

  toggleRow(key: OrderRsiRowKey): void {
    this.rowVisibility[key] = !this.rowVisibility[key];
  }

  toggleGann(grid: GannGridId, key: GannToggleKey): void {
    const vis = grid === 'bar1' ? this.gannBar1Visibility : this.gannBar0Visibility;
    vis[key] = !vis[key];
  }

  showGannPivot(grid: GannGridId): boolean {
    const vis = grid === 'bar1' ? this.gannBar1Visibility : this.gannBar0Visibility;
    return vis.gannOdd || vis.gannEven;
  }

  get gannBar0GridUnavailable(): boolean {
    if (!this.snapshot?.timeframes) return true;
    return !this.timeframeOrder.some(tf => this.gannAvailable('bar0', tf));
  }

  rowFor(tf: string): OrderRsiTfRow | undefined {
    return this.snapshot?.timeframes?.[tf];
  }

  bar0Rsi(tf: string): number | null {
    const row = this.rowFor(tf);
    if (!row) return null;
    if (this.rsiSourceMode === 'mt5_iRSI' && row.mt5?.available) {
      const v = row.mt5.shift0?.rsi;
      return v != null ? v : null;
    }
    return row.rsi ?? null;
  }

  bar1Rsi(tf: string): number | null {
    const row = this.rowFor(tf);
    if (!row) return null;
    if (this.rsiSourceMode === 'mt5_iRSI' && row.mt5?.available) {
      const v = row.mt5.shift1?.rsi;
      return v != null ? v : null;
    }
    return row.completed?.rsi ?? null;
  }

  bar0Close(tf: string): number | null {
    const row = this.rowFor(tf);
    if (!row) return null;
    if (this.rsiSourceMode === 'mt5_iRSI' && row.mt5?.available && row.mt5.shift0?.close != null) {
      return row.mt5.shift0.close;
    }
    return row.close ?? null;
  }

  bar1Close(tf: string): number | null {
    const row = this.rowFor(tf);
    if (!row) return null;
    if (this.rsiSourceMode === 'mt5_iRSI' && row.mt5?.available && row.mt5.shift1?.close != null) {
      return row.mt5.shift1.close;
    }
    return row.completed?.close ?? null;
  }

  srLevel(tf: string, bar: 'bar0' | 'bar1', level: OrderRsiSrLevelKey): number | null {
    const row = this.rowFor(tf);
    if (!row) return null;
    const block = bar === 'bar0' ? row.sr : row.completed?.sr;
    const value = block?.[level];
    return value != null ? value : null;
  }

  srLevelClass(level: OrderRsiSrLevelKey): string {
    if (level === 'pivot') return 'text-amber-300';
    if (level.startsWith('s')) return 'text-sky-300';
    return 'text-rose-300';
  }

  srRowBgClass(level: OrderRsiSrLevelKey): string {
    if (level === 'pivot') return 'bg-amber-950/10';
    if (level.startsWith('s')) return 'bg-sky-950/10';
    return 'bg-rose-950/10';
  }

  gannBlock(grid: GannGridId, tf: string): GannOddSquareBlock | undefined {
    const row = this.rowFor(tf);
    if (!row) return undefined;
    return grid === 'bar1' ? row.gannBar1 : row.gannBar0;
  }

  gannAvailable(grid: GannGridId, tf: string): boolean {
    const block = this.gannBlock(grid, tf);
    if (!block) return false;
    if (grid === 'bar0') return block.available === true;
    return block.available !== false && block.pivot != null;
  }

  gannPivotValue(grid: GannGridId, tf: string): number | null {
    if (!this.gannAvailable(grid, tf)) return null;
    return this.gannBlock(grid, tf)?.pivot ?? null;
  }

  gannOddBandValue(grid: GannGridId, tf: string, row: GannBandRowDef): number | null {
    if (!this.gannAvailable(grid, tf)) return null;
    const bands = this.gannBlock(grid, tf)?.oddSquare?.[row.direction];
    return bands?.[row.index] ?? null;
  }

  gannEvenBandValue(grid: GannGridId, tf: string, row: GannBandRowDef): number | null {
    if (!this.gannAvailable(grid, tf)) return null;
    const bands = this.gannBlock(grid, tf)?.evenSquare?.[row.direction];
    return bands?.[row.index] ?? null;
  }

  gannCellClass(grid: GannGridId, tf: string, value: number | null, kind: 'odd' | 'even'): string {
    const base = kind === 'odd' ? 'text-violet-300' : 'text-indigo-300';
    if (value == null) return base;
    const gann = this.gannBlock(grid, tf);
    if (!gann) return base;
    const isNext =
      value === gann.nextOddAbove ||
      value === gann.nextOddBelow ||
      value === gann.nextEvenAbove ||
      value === gann.nextEvenBelow;
    return isNext ? `${base} font-semibold underline decoration-violet-500/70` : base;
  }

  zoneBoxClass(rsi: number | null): string {
    return orderRsiZoneBoxClass(orderRsiZone(rsi));
  }
}
