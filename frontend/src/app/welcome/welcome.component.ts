import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Chart, ChartConfiguration, registerables, TooltipItem } from 'chart.js';
import { format } from 'date-fns';

Chart.register(...registerables);

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-900 pb-20 md:pb-0 text-gray-900 dark:text-gray-100">
      <!-- Modern Top Navigation -->
      <nav class="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50 hidden md:block">
        <div class="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
              <span class="text-white font-bold text-lg tracking-tighter">G</span>
            </div>
            <span class="font-semibold text-xl tracking-tight">Grok Dev</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">BETA</span>
          </div>
          
          <div class="flex items-center gap-3 text-sm">
            <button (click)="toggleDarkMode()" 
                    class="px-3 py-1 text-xs font-medium border border-gray-200 hover:bg-gray-50 active:bg-gray-100 rounded-2xl transition">
              {{ darkMode ? '☀️ Light' : '🌙 Dark' }}
            </button>
            <div class="text-right leading-none">
              <div class="text-xs text-gray-500">Signed in as</div>
              <div class="font-medium">{{ currentUser?.username || 'User' }}</div>
            </div>
            <button (click)="logout()" 
                    class="px-4 py-1.5 text-xs font-medium border border-gray-200 hover:bg-gray-50 active:bg-gray-100 rounded-2xl transition">
              Log out
            </button>
          </div>
        </div>
      </nav>

      <!-- Main Content (Market Data focused) -->
      <div class="max-w-6xl mx-auto px-5 pt-8 pb-8">

        <!-- XAUUSD Market Data - Senior UI/UX: Trader-centric, mobile-first, enriched -->
        <div class="mb-10">
          <div class="flex items-center justify-between mb-4 px-1">
            <div>
              <h2 class="text-2xl font-semibold text-gray-800">XAUUSD Market Data</h2>
              <p class="text-xs text-gray-500">Live from MT5 • All timeframes</p>
            </div>
            <button (click)="refreshMarket()" 
                    class="px-4 py-2 text-sm bg-blue-600 text-white rounded-2xl font-medium flex items-center gap-1.5 active:scale-95 transition shadow">
              <span>↻</span> <span class="hidden sm:inline">Refresh</span>
            </button>
          </div>

          <!-- Modern Timeframe Pills -->
          <div class="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1 snap-x scrollbar-hide">
            <button *ngFor="let tf of timeframes"
                    (click)="selectTimeframe(tf)"
                    class="px-6 py-2 text-sm font-semibold rounded-3xl border transition-all active:scale-[0.98] snap-start whitespace-nowrap"
                    [class.bg-blue-600]="selectedTimeframe === tf"
                    [class.text-white]="selectedTimeframe === tf"
                    [class.shadow-md]="selectedTimeframe === tf"
                    [class.border-blue-600]="selectedTimeframe === tf"
                    [class.bg-white]="selectedTimeframe !== tf"
                    [class.text-gray-700]="selectedTimeframe !== tf"
                    [class.border-gray-200]="selectedTimeframe !== tf"
                    [class.hover:bg-blue-50]="selectedTimeframe !== tf">
              {{ tf }}
            </button>
          </div>

          <!-- Quick Presets for ease -->
          <div class="flex gap-2 mb-4 flex-wrap">
            <button *ngFor="let p of ['1D','1W','1M','All']" 
                    (click)="applyPreset(p)"
                    class="px-3.5 py-1 text-xs font-medium bg-white border rounded-xl active:bg-gray-100">
              {{ p }}
            </button>
            <div class="flex-1"></div>
            <div class="text-xs text-gray-500 self-center">Showing {{ marketData.length }} candles</div>
          </div>

          <!-- Modern Segmented Tabs for Overview / Data Grid -->
          <div class="inline-flex p-1 bg-gray-100 rounded-2xl mb-4 text-sm font-semibold">
            <button (click)="setView('overview')"
                    class="px-5 py-1.5 rounded-xl transition-all"
                    [class.bg-white]="activeView === 'overview'"
                    [class.shadow-sm]="activeView === 'overview'"
                    [class.text-blue-700]="activeView === 'overview'"
                    [class.text-gray-600]="activeView !== 'overview'">
              Overview
            </button>
            <button (click)="setView('grid')"
                    class="px-5 py-1.5 rounded-xl transition-all"
                    [class.bg-white]="activeView === 'grid'"
                    [class.shadow-sm]="activeView === 'grid'"
                    [class.text-blue-700]="activeView === 'grid'"
                    [class.text-gray-600]="activeView !== 'grid'">
              Data Grid
            </button>
          </div>

          <div *ngIf="activeView === 'overview'">
            <!-- Modern Price Hero Card -->
            <div *ngIf="latestCandle" class="bg-white border border-gray-100 rounded-3xl p-6 mb-5 shadow-sm hover:shadow-md transition-all">
              <div class="flex justify-between items-start">
                <div>
                  <div class="uppercase tracking-[1.5px] text-[10px] font-medium text-gray-500">LATEST CLOSE • {{ selectedTimeframe }}</div>
                  <div class="text-[42px] sm:text-6xl font-semibold tracking-[-1.25px] mt-0.5 tabular-nums leading-none" [class.text-emerald-600]="priceChange >= 0" [class.text-rose-600]="priceChange < 0">
                    {{ latestCandle.close | number:'1.2-2' }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="inline-flex items-center px-3.5 py-1 rounded-full text-sm font-semibold"
                       [class.bg-emerald-100]="priceChange >= 0" [class.text-emerald-700]="priceChange >= 0"
                       [class.bg-rose-100]="priceChange < 0" [class.text-rose-700]="priceChange < 0">
                    {{ priceChange >= 0 ? '▲' : '▼' }} {{ priceChange | number:'1.2-2' }}%
                  </div>
                  <div class="text-xs text-gray-500 mt-1.5 font-mono">{{ latestCandle.time | date:'MMM dd HH:mm' }}</div>
                  <div *ngIf="syncStatus[selectedTimeframe]" class="text-[10px] text-gray-400 font-mono">
                    {{ timeSince(syncStatus[selectedTimeframe].lastCandleTime) }}
                  </div>
                </div>
              </div>
              <div class="mt-4 pt-4 border-t grid grid-cols-4 gap-3 text-sm">
                <div class="flex flex-col"><span class="text-[10px] uppercase tracking-widest text-gray-400">Open</span> <span class="font-mono">{{ latestCandle.open | number:'1.2-2' }}</span></div>
                <div class="flex flex-col"><span class="text-[10px] uppercase tracking-widest text-gray-400">High</span> <span class="font-mono text-emerald-600">{{ latestCandle.high | number:'1.2-2' }}</span></div>
                <div class="flex flex-col"><span class="text-[10px] uppercase tracking-widest text-gray-400">Low</span> <span class="font-mono text-rose-600">{{ latestCandle.low | number:'1.2-2' }}</span></div>
                <div class="flex flex-col"><span class="text-[10px] uppercase tracking-widest text-gray-400">Close</span> <span class="font-mono font-semibold">{{ latestCandle.close | number:'1.2-2' }}</span></div>
              </div>
            </div>

          <!-- Chart Container - Modern & clean -->
          <div class="bg-white border border-gray-100 rounded-3xl p-4 mb-5 shadow-sm">
            <div class="flex items-center justify-between text-xs text-gray-500 mb-2 px-1">
              <span>PRICE CHART</span>
              <span class="font-mono">CLOSE</span>
            </div>
            <div class="h-48 sm:h-56 relative">
              <canvas #marketChartCanvas></canvas>
              <div *ngIf="isMarketLoading" class="absolute inset-0 flex items-center justify-center bg-white/80 rounded-3xl text-sm">
                Loading...
              </div>
            </div>
          </div>

          <!-- Modern Recent Candles Table / Cards -->
          <div class="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
            <div class="px-4 py-2.5 border-b flex items-center text-xs font-semibold text-gray-500 bg-gray-50/60">
              <span>RECENT CANDLES</span>
              <span class="ml-auto hidden sm:block text-[10px]">LAST 12 • OHLC + VOL</span>
              <button (click)="exportOverviewToCsv()" 
                      [disabled]="marketData.length === 0"
                      class="ml-3 text-[10px] px-2 py-0.5 bg-white border text-emerald-600 hover:bg-emerald-50 rounded active:bg-emerald-100">
                CSV
              </button>
              <button (click)="copyVisibleToClipboard('overview')" 
                      [disabled]="marketData.length === 0"
                      class="ml-1 text-[10px] px-2 py-0.5 bg-white border text-blue-600 hover:bg-blue-50 rounded active:bg-blue-100">
                Copy
              </button>
            </div>

            <!-- Overview column visibility (compact) -->
            <div class="px-4 pt-2 pb-1 bg-white text-xs">
              <div class="flex flex-wrap items-center gap-1 mb-1">
                <span class="text-[10px] text-gray-400 mr-1">Show:</span>
                <ng-container *ngFor="let col of overviewColumnDefs">
                  <div class="flex items-center border rounded overflow-hidden text-[10px]"
                       draggable="true"
                       (dragstart)="onOverviewDragStart($event, col.key)"
                       (dragover)="onOverviewDragOver($event)"
                       (drop)="onOverviewDrop($event, col.key)">
                    <button (click)="toggleOverviewColumn(col.key)"
                            class="px-1.5 py-px transition"
                            [class.bg-blue-600]="isOverviewColumnVisible(col.key)"
                            [class.text-white]="isOverviewColumnVisible(col.key)"
                            [class.text-gray-500]="!isOverviewColumnVisible(col.key)">
                      {{ col.label }}
                    </button>
                    <div *ngIf="isOverviewColumnVisible(col.key)" class="flex text-[9px] border-l">
                      <button (click)="moveOverviewColumn(col.key, 'up'); $event.stopImmediatePropagation()" class="px-0.5">↑</button>
                      <button (click)="moveOverviewColumn(col.key, 'down'); $event.stopImmediatePropagation()" class="px-0.5 border-l">↓</button>
                    </div>
                  </div>
                </ng-container>
                <button (click)="showAllOverviewColumns()" class="px-1.5 py-px text-emerald-600 border border-emerald-200 rounded">All</button>
                <button (click)="hideAllOverviewColumns()" class="px-1.5 py-px text-rose-600 border border-rose-200 rounded">None</button>
              </div>
            </div>
            
            <!-- Desktop Table - Modern styling -->
            <table class="hidden md:table w-full text-sm">
              <thead>
                <tr class="border-b text-[10px] uppercase tracking-widest text-gray-400">
                  <th *ngFor="let col of getOrderedVisibleOverviewColumns()" 
                      class="text-left py-2 px-4 font-medium">{{ col.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let candle of marketData.slice(0, 12)" class="border-b last:border-none hover:bg-gray-50/80 transition-colors">
                  <td *ngFor="let col of getOrderedVisibleOverviewColumns()" 
                      class="px-2 py-2 font-mono text-xs"
                      [ngClass]="{'text-right': ['open','high','low','close','vol'].includes(col.key), 'text-gray-600': col.key==='time'}">
                    <ng-container [ngSwitch]="col.key">
                      <span *ngSwitchCase="'time'">{{ candle.time | date:'MMM dd HH:mm' }}</span>
                      <span *ngSwitchCase="'open'">{{ candle.open | number:'1.2-2' }}</span>
                      <span *ngSwitchCase="'high'">{{ candle.high | number:'1.2-2' }}</span>
                      <span *ngSwitchCase="'low'">{{ candle.low | number:'1.2-2' }}</span>
                      <span *ngSwitchCase="'close'">{{ candle.close | number:'1.2-2' }}</span>
                      <span *ngSwitchCase="'vol'">{{ (candle.tickVolume / 1000) | number:'1.0-0' }}k</span>
                    </ng-container>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Mobile Cards -->
            <div class="md:hidden divide-y text-sm">
              <div *ngFor="let candle of marketData.slice(0, 8)" 
                   class="p-3.5 active:bg-gray-50 flex flex-col gap-y-1">
                <div class="flex justify-between items-baseline">
                  <span *ngIf="isOverviewColumnVisible('time')" class="font-mono text-xs text-gray-500">{{ candle.time | date:'MMM dd HH:mm' }}</span>
                  <span class="font-semibold text-base tabular-nums" [ngClass]="getCandleColor(candle)">
                    {{ candle.close | number:'1.2-2' }}
                  </span>
                </div>
                <div class="grid gap-1 text-[11px] font-mono text-center" [style.grid-template-columns]="'repeat(' + visibleOverviewColumnCount + ', minmax(0, 1fr))'">
                  <div *ngIf="isOverviewColumnVisible('open')"><span class="text-[9px] text-gray-400 block">O</span>{{ candle.open | number:'1.2-2' }}</div>
                  <div *ngIf="isOverviewColumnVisible('high')"><span class="text-[9px] text-emerald-400 block">H</span>{{ candle.high | number:'1.2-2' }}</div>
                  <div *ngIf="isOverviewColumnVisible('low')"><span class="text-[9px] text-rose-400 block">L</span>{{ candle.low | number:'1.2-2' }}</div>
                  <div *ngIf="isOverviewColumnVisible('close')"><span class="text-[9px] text-gray-400 block">C</span>{{ candle.close | number:'1.2-2' }}</div>
                  <div *ngIf="isOverviewColumnVisible('vol')"><span class="text-[9px] text-gray-400 block">VOL</span>{{ (candle.tickVolume / 1000) | number:'1.0-0' }}k</div>
                </div>
              </div>
            </div>
          </div>
          </div> <!-- end overview -->

          <!-- Modern Data Grid Tab -->
          <div *ngIf="activeView === 'grid'" class="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
            <div class="px-5 py-3 border-b flex items-center justify-between bg-gray-50/70 text-xs font-semibold text-gray-500 tracking-wider">
              <span>DATA GRID — TIMES (Broker / NY / IST) • OHLC • RSI(14)</span>
              <span class="text-[10px] font-normal">NEWEST FIRST</span>
            </div>

            <!-- Column visibility toggles -->
            <div class="px-5 pt-3 pb-1 bg-white border-b">
              <div class="flex items-center justify-between mb-1.5">
                <div class="text-[10px] uppercase tracking-[1px] text-gray-400 font-medium">Columns</div>
                <div class="flex gap-1">
                  <button (click)="toggleTimesGroup()"
                          class="text-[10px] px-2 py-0.5 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded active:bg-blue-100">
                    Times
                  </button>
                  <button (click)="showAllGridColumns()"
                          class="text-[10px] px-2 py-0.5 text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded active:bg-emerald-100">
                    Show all
                  </button>
                  <button (click)="hideAllGridColumns()"
                          class="text-[10px] px-2 py-0.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded active:bg-rose-100">
                    Hide all
                  </button>
                  <button (click)="resetGridColumns()"
                          class="text-[10px] px-2 py-0.5 text-gray-500 hover:text-blue-600 border border-gray-200 rounded active:bg-gray-50">
                    Reset
                  </button>
                </div>
              </div>
              <!-- Presets -->
              <div class="flex flex-wrap gap-1 mb-1">
                <button (click)="applyGridPreset('all')" class="text-[9px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded">All</button>
                <button (click)="applyGridPreset('times+core')" class="text-[9px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded">Times+OHLC</button>
                <button (click)="applyGridPreset('rsi')" class="text-[9px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded">+RSI</button>
                <button (click)="applyGridPreset('minimal')" class="text-[9px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded">Minimal</button>
              </div>
              <div class="flex flex-wrap gap-1">
                <ng-container *ngFor="let col of gridColumnDefs">
                  <div class="flex items-center border rounded-full overflow-hidden"
                       [class.bg-blue-600]="isGridColumnVisible(col.key)"
                       [class.border-blue-600]="isGridColumnVisible(col.key)"
                       [class.bg-white]="!isGridColumnVisible(col.key)"
                       [class.border-gray-200]="!isGridColumnVisible(col.key)"
                       draggable="true"
                       (dragstart)="onGridDragStart($event, col.key)"
                       (dragover)="onGridDragOver($event)"
                       (drop)="onGridDrop($event, col.key)"
                       (dragend)="onGridDragEnd()">
                    <button (click)="toggleGridColumn(col.key)"
                            class="px-2 py-0.5 text-[10px] font-medium transition"
                            [class.text-white]="isGridColumnVisible(col.key)"
                            [class.text-gray-600]="!isGridColumnVisible(col.key)"
                            [title]="col.title">
                      {{ col.label }}
                    </button>
                    <div *ngIf="isGridColumnVisible(col.key)" class="flex border-l border-white/30">
                      <button (click)="moveGridColumn(col.key, 'up'); $event.stopImmediatePropagation()" 
                              class="px-1 text-white/80 hover:text-white text-[9px] leading-none">↑</button>
                      <button (click)="moveGridColumn(col.key, 'down'); $event.stopImmediatePropagation()" 
                              class="px-1 text-white/80 hover:text-white text-[9px] leading-none border-l border-white/30">↓</button>
                    </div>
                  </div>
                </ng-container>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b text-[10px] uppercase tracking-[1px] text-gray-400 bg-gray-50">
                    <th *ngFor="let col of getOrderedVisibleGridColumns()" 
                        class="text-left py-2.5 px-2 font-medium" 
                        [title]="col.title">
                      {{ col.label.toUpperCase() }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr *ngFor="let row of gridData" class="hover:bg-blue-50/30 transition-colors group">
                    <td *ngFor="let col of getOrderedVisibleGridColumns()" 
                        class="px-2 py-2.5 font-mono text-[11px]"
                        [ngClass]="{
                          'text-gray-700 group-hover:text-gray-900': col.key === 'broker',
                          'text-blue-700': col.key === 'ny',
                          'text-emerald-700': col.key === 'ist',
                          'text-right': ['open','high','low','close','rsi'].includes(col.key)
                        }">
                      <ng-container [ngSwitch]="col.key">
                        <span *ngSwitchCase="'broker'">{{ row.time ? (row.time | date:'MMM dd HH:mm') : '—' }}</span>
                        <span *ngSwitchCase="'ny'">{{ row.nyTime ? (row.nyTime | date:'MMM dd HH:mm') : '—' }}</span>
                        <span *ngSwitchCase="'ist'">{{ row.istTime ? (row.istTime | date:'MMM dd HH:mm') : '—' }}</span>
                        <span *ngSwitchCase="'open'">{{ row.open | number:'1.2-2' }}</span>
                        <span *ngSwitchCase="'high'">{{ row.high | number:'1.2-2' }}</span>
                        <span *ngSwitchCase="'low'">{{ row.low | number:'1.2-2' }}</span>
                        <span *ngSwitchCase="'close'">{{ row.close | number:'1.2-2' }}</span>
                        <span *ngSwitchCase="'rsi'">
                          <span *ngIf="row.rsi != null" 
                                class="inline-block min-w-[52px] px-2 py-px rounded font-medium text-xs"
                                [class.bg-emerald-100]="row.rsi > 50" [class.text-emerald-700]="row.rsi > 50"
                                [class.bg-rose-100]="row.rsi <= 50" [class.text-rose-700]="row.rsi <= 50">
                            {{ row.rsi | number:'1.1-1' }}
                          </span>
                          <span *ngIf="row.rsi == null" class="text-gray-300">—</span>
                        </span>
                      </ng-container>
                    </td>
                  </tr>
                  <tr *ngIf="gridData.length === 0 && !isGridLoading">
                    <td [attr.colspan]="visibleGridColumnCount" class="px-5 py-8 text-center text-sm text-gray-400">No data loaded for this timeframe. Tap refresh.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="px-4 py-3 bg-gray-50 border-t flex items-center justify-between text-xs">
              <div class="text-gray-500">{{ gridData.length }} rows</div>
              <div class="flex items-center gap-2">
                <button (click)="exportGridToCsv()" 
                        [disabled]="gridData.length === 0"
                        class="px-3 py-1 bg-white border text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 rounded-2xl font-medium text-xs transition disabled:opacity-60">
                  ⬇ CSV
                </button>
                <button (click)="copyVisibleToClipboard('grid')" 
                        [disabled]="gridData.length === 0"
                        class="px-3 py-1 bg-white border text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-2xl font-medium text-xs transition disabled:opacity-60">
                  Copy
                </button>
                <button (click)="loadGridData()" 
                        [disabled]="isGridLoading"
                        class="px-4 py-1 bg-white border text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-2xl font-medium text-xs transition disabled:opacity-60">
                  {{ isGridLoading ? 'LOADING...' : 'REFRESH' }}
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- Dedicated Modern Health Dashboard -->
        <div class="mb-10">
          <div class="flex items-center justify-between mb-3 px-1">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">Pipeline Health</h2>
            </div>
            <button (click)="loadHealthStatus()" 
                    class="text-xs px-3 py-1.5 bg-white border hover:bg-gray-50 active:bg-gray-100 text-gray-600 rounded-2xl font-medium flex items-center gap-1 transition">
              ↻ <span class="hidden xs:inline">Refresh</span>
            </button>
          </div>

          <div *ngIf="healthStatus.status" class="flex items-center gap-2 mb-3 text-sm">
            <div class="px-3 py-px rounded-full text-xs font-semibold tracking-wider"
                 [class.bg-emerald-100]="healthStatus.status === 'UP'"
                 [class.text-emerald-700]="healthStatus.status === 'UP'"
                 [class.bg-amber-100]="healthStatus.status === 'DEGRADED'"
                 [class.text-amber-700]="healthStatus.status === 'DEGRADED'"
                 [class.bg-rose-100]="healthStatus.status === 'DOWN'"
                 [class.text-rose-700]="healthStatus.status === 'DOWN'">
              {{ healthStatus.status }}
            </div>
            <div class="text-[10px] text-gray-400">{{ healthStatus.checkedAt | date:'MMM dd, HH:mm' }}</div>
            <div *ngIf="healthStatus.freshCount != null" class="ml-auto text-xs font-medium text-gray-500">
              {{ healthStatus.freshCount }}/{{ healthStatus.total || 6 }} fresh
            </div>
          </div>

          <!-- Health TF visibility toggles -->
          <div class="px-1 pb-1">
            <div class="text-[10px] uppercase tracking-[1px] text-gray-400 mb-1">Health TFs</div>
            <div class="flex flex-wrap gap-1">
              <button *ngFor="let tf of timeframes"
                      (click)="toggleHealthTf(tf)"
                      class="px-2 py-0.5 text-[10px] rounded border transition"
                      [class.bg-blue-600]="isHealthTfVisible(tf)"
                      [class.text-white]="isHealthTfVisible(tf)"
                      [class.border-blue-600]="isHealthTfVisible(tf)"
                      [class.bg-white]="!isHealthTfVisible(tf)"
                      [class.text-gray-600]="!isHealthTfVisible(tf)"
                      [class.border-gray-200]="!isHealthTfVisible(tf)">
                {{ tf }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <div *ngFor="let tf of timeframes" 
                 *ngIf="isHealthTfVisible(tf)"
                 class="bg-white border border-gray-100 rounded-2xl px-3 py-2.5 text-sm shadow-sm flex justify-between items-center transition hover:border-gray-200"
                 [class.border-emerald-200]="isFresh(tf)"
                 [class.border-amber-200]="!isFresh(tf) && syncStatus[tf]">
              <div>
                <div class="font-semibold text-gray-900">{{ tf }}</div>
                <div class="font-mono text-xs text-gray-500">
                  {{ syncStatus[tf]?.lastCandleTime ? (syncStatus[tf].lastCandleTime | date:'HH:mm') : '—' }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-[10px] font-medium" 
                     [class.text-emerald-600]="isFresh(tf)"
                     [class.text-amber-600]="!isFresh(tf) && syncStatus[tf]"
                     [class.text-gray-400]="!syncStatus[tf]">
                  {{ isFresh(tf) ? 'FRESH' : (syncStatus[tf] ? timeSince(syncStatus[tf].lastCandleTime) : '—') }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Session & Admin - Modern cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <!-- Session -->
          <div class="bg-white border border-gray-100 rounded-3xl p-5 text-sm">
            <div class="flex justify-between">
              <div>
                <div class="font-semibold">Session</div>
                <div class="text-gray-500 text-xs mt-px">{{ expirationInfo || 'Active' }}</div>
              </div>
              <button (click)="refreshManually()" 
                      class="self-start text-xs px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl font-medium active:scale-[0.985]">
                Refresh
              </button>
            </div>
          </div>

          <!-- Admin -->
          <div *ngIf="isAdmin()" class="bg-white border border-amber-200 rounded-3xl p-5 text-sm bg-gradient-to-br from-amber-50 to-white">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-semibold text-amber-900">Admin Controls</div>
                <div class="text-amber-700/80 text-xs">Advanced features</div>
              </div>
              <button class="px-3 py-1 bg-amber-600 text-white text-xs rounded-2xl font-medium active:scale-[0.985]">
                Manage
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modern Mobile Bottom Nav -->
      <div class="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t z-50 px-2 py-1">
        <div class="flex justify-around items-center text-[10px] font-medium">
          <div (click)="setView('overview')" class="flex flex-col items-center py-1 px-3 active:text-blue-600" [class.text-blue-600]="activeView === 'overview'">
            <span class="text-lg mb-px">📈</span>
            <span>Overview</span>
          </div>
          <div (click)="setView('grid')" class="flex flex-col items-center py-1 px-3 active:text-blue-600" [class.text-blue-600]="activeView === 'grid'">
            <span class="text-lg mb-px">📋</span>
            <span>Grid</span>
          </div>
          <div (click)="loadHealthStatus()" class="flex flex-col items-center py-1 px-3 active:text-blue-600">
            <span class="text-lg mb-px">❤️</span>
            <span>Health</span>
          </div>
          <div (click)="refreshManually()" class="flex flex-col items-center py-1 px-3 text-gray-400 active:text-blue-600">
            <span class="text-lg mb-px">🔄</span>
            <span>Session</span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class WelcomeComponent implements OnInit, OnDestroy, AfterViewInit {
  currentUser: any = null;
  expirationInfo: string = '';
  isAdminUser = false;
  private expirationInterval?: ReturnType<typeof setInterval>;

  // Market Data - Enriched UX for traders on mobile/tablet
  timeframes = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
  selectedTimeframe = 'D1';
  marketData: any[] = [];
  latestCandle: any = null;
  priceChange = 0;
  isMarketLoading = false;
  marketLimit = 100;
  healthStatus: any = {};
  syncStatus: any = {};
  private marketChart?: Chart;

  // Dark mode toggle
  darkMode = false;

  // Data Grid tab
  activeView: 'overview' | 'grid' = 'overview';
  gridData: any[] = [];
  isGridLoading = false;

  // Column visibility toggles for Data Grid (all on by default)
  gridColumnVisibility: { [key: string]: boolean } = {
    broker: true,
    ny: true,
    ist: true,
    open: true,
    high: true,
    low: true,
    close: true,
    rsi: true
  };

  gridColumnDefs = [
    { key: 'broker', label: 'Broker', title: 'Broker / MT5 server time' },
    { key: 'ny', label: 'NY', title: 'New York time' },
    { key: 'ist', label: 'IST', title: 'Indian Standard Time' },
    { key: 'open', label: 'O', title: 'Open' },
    { key: 'high', label: 'H', title: 'High' },
    { key: 'low', label: 'L', title: 'Low' },
    { key: 'close', label: 'C', title: 'Close' },
    { key: 'rsi', label: 'RSI', title: 'RSI (14)' }
  ];

  // Current display order for grid columns (persisted per TF)
  gridColumnOrder: string[] = ['broker', 'ny', 'ist', 'open', 'high', 'low', 'close', 'rsi'];

  // Visibility for Overview recent candles table/cards
  overviewColumnVisibility: { [key: string]: boolean } = {
    time: true,
    open: true,
    high: true,
    low: true,
    close: true,
    vol: true
  };

  overviewColumnDefs = [
    { key: 'time', label: 'Time', title: 'Time' },
    { key: 'open', label: 'O', title: 'Open' },
    { key: 'high', label: 'H', title: 'High' },
    { key: 'low', label: 'L', title: 'Low' },
    { key: 'close', label: 'C', title: 'Close' },
    { key: 'vol', label: 'Vol', title: 'Volume' }
  ];

  // Current display order for overview columns (persisted per TF)
  overviewColumnOrder: string[] = ['time', 'open', 'high', 'low', 'close', 'vol'];

  // Visibility for Health dashboard TF cards
  healthTfVisibility: { [key: string]: boolean } = {
    'D1': true, 'H4': true, 'H1': true, 'M15': true, 'M5': true, 'M1': true
  };

  // Grid filters
  gridFrom: string = '';
  gridTo: string = '';
  gridRsiMin: number | null = null;
  gridRsiMax: number | null = null;
  gridSort: 'time-desc' | 'time-asc' | 'close-desc' | 'rsi-desc' = 'time-desc';

  @ViewChild('marketChartCanvas') marketChartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    
    // Proactively ensure valid session
    this.authService.ensureValidSession();

    // Role-based UI
    this.isAdminUser = this.authService.hasRole('ROLE_ADMIN');

    // Refresh roles
    this.http.get<any>(`${environment.apiUrl}/auth/me`).subscribe({
      next: (me) => {
        const u = this.authService.getCurrentUser() || { username: me.username };
        localStorage.setItem('currentUser', JSON.stringify({ username: u.username, roles: me.roles || [] }));
        this.currentUser = this.authService.getCurrentUser();
        this.isAdminUser = this.authService.hasRole('ROLE_ADMIN');
      },
      error: () => {}
    });

    // Dark mode init
    const savedDark = localStorage.getItem('darkMode') === 'true';
    this.darkMode = savedDark;
    if (savedDark) {
      document.documentElement.classList.add('dark');
    }

    // Start live countdown
    this.startLiveCountdown();

    // Load market data
    this.loadMarketData();

    // Restore column visibility prefs for Data Grid + Overview
    this.loadGridColumnVisibility();
    this.loadOverviewColumnVisibility();

    // Health TF visibility
    const savedHealth = localStorage.getItem('healthTfVisibility');
    if (savedHealth) {
      try {
        this.healthTfVisibility = { ...this.healthTfVisibility, ...JSON.parse(savedHealth) };
      } catch {}
    }

    // Load from backend (overrides local for current TF)
    this.loadPreferencesFromBackend();
  }

  ngAfterViewInit() {
    // Chart will render after data loads
  }



  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    if (this.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', this.darkMode.toString());
  }

  refreshManually() {
    this.authService.refreshToken().subscribe({
      next: () => {
        this.updateExpirationDisplay();
        alert('Access token refreshed successfully!');
      },
      error: () => {
        alert('Failed to refresh token. Please log in again.');
        this.logout();
      }
    });
  }

  private startLiveCountdown() {
    this.updateExpirationDisplay();

    // Update every 10 seconds for a responsive live countdown
    this.expirationInterval = setInterval(() => {
      this.updateExpirationDisplay();
    }, 10000);
  }

  private updateExpirationDisplay() {
    const exp = this.authService.getTokenExpiration();
    if (!exp) {
      this.expirationInfo = '';
      return;
    }

    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();

    if (diffMs <= 0) {
      this.expirationInfo = 'Access token expired — auto-refreshing on next request';
      return;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes >= 1) {
      this.expirationInfo = `Access token expires in ${minutes}m ${seconds}s`;
    } else {
      this.expirationInfo = `Access token expires in ${seconds}s (refreshing soon)`;
    }
  }

  isAdmin(): boolean {
    return this.isAdminUser;
  }

  // ==================== Market Data - Senior UI/UX Design ====================
  // User perspective: Trader needs instant access to latest price, easy TF switch on thumb,
  // visual cues for direction, clean data table on phone/tablet.
  // Enrich: Big price, % change, color coded rows, interactive chart.
  // Responsive: Pills scroll on mobile, cards/table stack, large tap areas.

  loadMarketData() {
    this.isMarketLoading = true;
    const params = `limit=${this.marketLimit}`;
    this.http.get<any[]>(`${environment.apiUrl}/market/xauusd/${this.selectedTimeframe}?${params}`).subscribe({
      next: (data) => {
        this.marketData = data || [];
        this.latestCandle = this.marketData.length > 0 ? this.marketData[this.marketData.length - 1] : null;
        this.calculatePriceChange();
        this.isMarketLoading = false;
        // Render chart after data + DOM ready
        setTimeout(() => this.renderMarketChart(), 100);
      },
      error: (err) => {
        console.error('Market data error:', err);
        this.marketData = this.getFallbackMarketData();
        this.latestCandle = this.marketData[this.marketData.length - 1];
        this.calculatePriceChange();
        this.isMarketLoading = false;
        setTimeout(() => this.renderMarketChart(), 100);
      }
    });

    // Fetch health for dedicated dashboard
    this.loadHealthStatus();
  }

  loadHealthStatus() {
    this.http.get<any>(`${environment.apiUrl}/market/xauusd/health`).subscribe({
      next: (health) => {
        this.healthStatus = health || {};
        this.syncStatus = this.healthStatus.details || {};
      },
      error: () => {}
    });
  }

  selectTimeframe(tf: string) {
    if (this.selectedTimeframe === tf) return;

    // Persist current visibility before switching
    this.saveGridVisibilityForTf(this.selectedTimeframe);
    this.saveOverviewVisibilityForTf(this.selectedTimeframe);

    this.selectedTimeframe = tf;

    // Load visibility for new timeframe
    this.loadGridVisibilityForTf(tf);
    this.loadOverviewVisibilityForTf(tf);

    this.marketChart?.destroy();
    this.loadMarketData();
    if (this.activeView === 'grid') {
      this.gridData = [];
      this.loadGridData();
    }
  }

  applyPreset(preset: string) {
    // For future: could pass from/to to API, for now adjust limit for "recent" feel
    const limits: { [key: string]: number } = {
      '1D': 50,
      '1W': 200,
      '1M': 500,
      'All': 1000
    };
    this.marketLimit = limits[preset] || 100;
    this.loadMarketData();
  }

  refreshMarket() {
    this.marketChart?.destroy();
    this.loadMarketData();
    this.loadHealthStatus();
  }

  setView(view: 'overview' | 'grid') {
    this.activeView = view;
    if (view === 'grid' && this.gridData.length === 0) {
      this.loadGridData();
    }
  }

  loadGridData() {
    this.isGridLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/market/xauusd/${this.selectedTimeframe}/grid?limit=${this.marketLimit}`).subscribe({
      next: (data) => {
        this.gridData = data || [];
        this.isGridLoading = false;
      },
      error: (err) => {
        console.error('Grid data error:', err);
        this.gridData = this.getFallbackMarketData(); // reuse for demo
        this.isGridLoading = false;
      }
    });
  }

  // ==================== Data Grid Column Visibility ====================
  isGridColumnVisible(key: string): boolean {
    return this.gridColumnVisibility[key] !== false;
  }

  get visibleGridColumnCount(): number {
    return this.gridColumnDefs.filter(c => this.isGridColumnVisible(c.key)).length || 1;
  }

  private loadGridColumnVisibility() {
    // Initial load uses default or global (for first TF)
    const tf = this.selectedTimeframe;
    this.loadGridVisibilityForTf(tf);
  }

  private loadGridVisibilityForTf(tf: string) {
    const visKey = `gridColumnVisibility_${tf}`;
    const orderKey = `gridColumnOrder_${tf}`;
    const savedVis = localStorage.getItem(visKey);
    const savedOrder = localStorage.getItem(orderKey);

    if (savedVis) {
      try {
        const parsed = JSON.parse(savedVis);
        this.gridColumnVisibility = { ...this.gridColumnVisibility, ...parsed };
      } catch {}
    } else {
      this.gridColumnVisibility = {
        broker: true, ny: true, ist: true,
        open: true, high: true, low: true, close: true, rsi: true
      };
    }

    if (savedOrder) {
      try {
        const parsedOrder: string[] = JSON.parse(savedOrder);
        // Filter to valid keys only
        this.gridColumnOrder = parsedOrder.filter(k => this.gridColumnDefs.some(d => d.key === k));
        // Append any missing
        const missing = this.gridColumnDefs.map(d => d.key).filter(k => !this.gridColumnOrder.includes(k));
        this.gridColumnOrder.push(...missing);
      } catch {}
    }
  }

  private saveGridVisibilityForTf(tf: string) {
    const visKey = `gridColumnVisibility_${tf}`;
    const orderKey = `gridColumnOrder_${tf}`;
    localStorage.setItem(visKey, JSON.stringify(this.gridColumnVisibility));
    localStorage.setItem(orderKey, JSON.stringify(this.gridColumnOrder));
  }

  private saveGridColumnVisibility() {
    this.saveGridVisibilityForTf(this.selectedTimeframe);
    this.savePreferencesToBackend();
  }

  toggleGridColumn(key: string) {
    const wasVisible = this.isGridColumnVisible(key);
    this.gridColumnVisibility[key] = !wasVisible;
    if (!wasVisible && !this.gridColumnOrder.includes(key)) {
      this.gridColumnOrder.push(key);
    }
    this.saveGridColumnVisibility();
  }

  moveGridColumn(key: string, direction: 'up' | 'down') {
    const idx = this.gridColumnOrder.indexOf(key);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= this.gridColumnOrder.length) return;
    [this.gridColumnOrder[idx], this.gridColumnOrder[newIdx]] = [this.gridColumnOrder[newIdx], this.gridColumnOrder[idx]];
    this.saveGridColumnVisibility();
  }

  getOrderedVisibleGridColumns() {
    return this.gridColumnOrder
      .filter(k => this.isGridColumnVisible(k))
      .map(k => this.gridColumnDefs.find(d => d.key === k))
      .filter((d): d is any => !!d);
  }

  // Drag and drop for grid column reordering
  onGridDragStart(event: DragEvent, key: string) {
    event.dataTransfer?.setData('text/plain', key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onGridDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onGridDrop(event: DragEvent, targetKey: string) {
    event.preventDefault();
    const draggedKey = event.dataTransfer?.getData('text/plain');
    if (!draggedKey || draggedKey === targetKey) return;
    const fromIdx = this.gridColumnOrder.indexOf(draggedKey);
    const toIdx = this.gridColumnOrder.indexOf(targetKey);
    if (fromIdx > -1 && toIdx > -1) {
      const [moved] = this.gridColumnOrder.splice(fromIdx, 1);
      this.gridColumnOrder.splice(toIdx, 0, moved);
      this.saveGridColumnVisibility();
    }
  }

  onGridDragEnd() {
    // optional cleanup
  }

  resetGridColumns() {
    this.gridColumnVisibility = {
      broker: true, ny: true, ist: true,
      open: true, high: true, low: true, close: true, rsi: true
    };
    this.saveGridColumnVisibility();
  }

  exportGridToCsv() {
    const data = this.gridData;
    if (!data || data.length === 0) return;

    const visibleCols = this.getOrderedVisibleGridColumns();
    if (visibleCols.length === 0) return;

    const headers = visibleCols.map(c => c.label);

    const csvRows: string[] = [];
    csvRows.push(headers.join(','));

    data.forEach((row: any) => {
      const values = visibleCols.map(col => {
        let val: any;
        switch (col.key) {
          case 'broker': val = row.time; break;
          case 'ny': val = row.nyTime; break;
          case 'ist': val = row.istTime; break;
          case 'open': val = row.open; break;
          case 'high': val = row.high; break;
          case 'low': val = row.low; break;
          case 'close': val = row.close; break;
          case 'rsi': val = row.rsi; break;
          default: val = '';
        }
        if (val == null) return '';
        // Escape commas and quotes for CSV
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `XAUUSD_${this.selectedTimeframe}_visible_${dateStr}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  showAllGridColumns() {
    Object.keys(this.gridColumnVisibility).forEach(k => this.gridColumnVisibility[k] = true);
    this.gridColumnOrder = this.gridColumnDefs.map(d => d.key);
    this.saveGridColumnVisibility();
  }

  hideAllGridColumns() {
    Object.keys(this.gridColumnVisibility).forEach(k => this.gridColumnVisibility[k] = false);
    this.saveGridColumnVisibility();
  }

  toggleTimesGroup() {
    const times = ['broker', 'ny', 'ist'];
    const anyVisible = times.some(k => this.isGridColumnVisible(k));
    times.forEach(k => this.gridColumnVisibility[k] = !anyVisible);
    this.saveGridColumnVisibility();
  }

  applyGridPreset(preset: string) {
    const all = this.gridColumnDefs.map(d => d.key);
    switch (preset) {
      case 'all':
        all.forEach(k => this.gridColumnVisibility[k] = true);
        this.gridColumnOrder = [...all];
        break;
      case 'times+core':
        ['broker','ny','ist','open','high','low','close'].forEach(k => this.gridColumnVisibility[k] = true);
        ['rsi'].forEach(k => this.gridColumnVisibility[k] = false);
        this.gridColumnOrder = ['broker','ny','ist','open','high','low','close','rsi'];
        break;
      case 'rsi':
        all.forEach(k => this.gridColumnVisibility[k] = true);
        this.gridColumnOrder = ['broker','ny','ist','open','high','low','close','rsi'];
        break;
      case 'minimal':
        ['open','high','low','close'].forEach(k => this.gridColumnVisibility[k] = true);
        ['broker','ny','ist','rsi'].forEach(k => this.gridColumnVisibility[k] = false);
        this.gridColumnOrder = ['open','high','low','close'];
        break;
    }
    this.saveGridColumnVisibility();
  }

  // Overview visibility
  toggleOverviewColumn(key: string) {
    const wasVisible = this.isOverviewColumnVisible(key);
    this.overviewColumnVisibility[key] = !wasVisible;
    if (!wasVisible && !this.overviewColumnOrder.includes(key)) {
      this.overviewColumnOrder.push(key);
    }
    this.saveOverviewColumnVisibility();
  }

  isOverviewColumnVisible(key: string): boolean {
    return this.overviewColumnVisibility[key] !== false;
  }

  moveOverviewColumn(key: string, direction: 'up' | 'down') {
    const idx = this.overviewColumnOrder.indexOf(key);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= this.overviewColumnOrder.length) return;
    [this.overviewColumnOrder[idx], this.overviewColumnOrder[newIdx]] = [this.overviewColumnOrder[newIdx], this.overviewColumnOrder[idx]];
    this.saveOverviewColumnVisibility();
  }

  getOrderedVisibleOverviewColumns() {
    return this.overviewColumnOrder
      .filter(k => this.isOverviewColumnVisible(k))
      .map(k => this.overviewColumnDefs.find(d => d.key === k))
      .filter((d): d is any => !!d);
  }

  toggleHealthTf(tf: string) {
    this.healthTfVisibility[tf] = !this.healthTfVisibility[tf];
    localStorage.setItem('healthTfVisibility', JSON.stringify(this.healthTfVisibility));
    this.savePreferencesToBackend();
  }

  isHealthTfVisible(tf: string): boolean {
    return this.healthTfVisibility[tf] !== false;
  }

  // Drag and drop for overview column reordering
  onOverviewDragStart(event: DragEvent, key: string) {
    event.dataTransfer?.setData('text/plain', key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onOverviewDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onOverviewDrop(event: DragEvent, targetKey: string) {
    event.preventDefault();
    const draggedKey = event.dataTransfer?.getData('text/plain');
    if (!draggedKey || draggedKey === targetKey) return;
    const fromIdx = this.overviewColumnOrder.indexOf(draggedKey);
    const toIdx = this.overviewColumnOrder.indexOf(targetKey);
    if (fromIdx > -1 && toIdx > -1) {
      const [moved] = this.overviewColumnOrder.splice(fromIdx, 1);
      this.overviewColumnOrder.splice(toIdx, 0, moved);
      this.saveOverviewColumnVisibility();
    }
  }

  get visibleOverviewColumnCount(): number {
    return this.overviewColumnDefs.filter(c => this.isOverviewColumnVisible(c.key)).length || 1;
  }

  showAllOverviewColumns() {
    Object.keys(this.overviewColumnVisibility).forEach(k => this.overviewColumnVisibility[k] = true);
    this.overviewColumnOrder = this.overviewColumnDefs.map(d => d.key);
    this.saveOverviewColumnVisibility();
  }

  hideAllOverviewColumns() {
    Object.keys(this.overviewColumnVisibility).forEach(k => this.overviewColumnVisibility[k] = false);
    this.saveOverviewColumnVisibility();
  }

  private loadOverviewColumnVisibility() {
    const tf = this.selectedTimeframe;
    this.loadOverviewVisibilityForTf(tf);
  }

  private loadOverviewVisibilityForTf(tf: string) {
    const visKey = `overviewColumnVisibility_${tf}`;
    const orderKey = `overviewColumnOrder_${tf}`;
    const savedVis = localStorage.getItem(visKey);
    const savedOrder = localStorage.getItem(orderKey);

    if (savedVis) {
      try {
        const parsed = JSON.parse(savedVis);
        this.overviewColumnVisibility = { ...this.overviewColumnVisibility, ...parsed };
      } catch {}
    } else {
      this.overviewColumnVisibility = {
        time: true, open: true, high: true, low: true, close: true, vol: true
      };
    }

    if (savedOrder) {
      try {
        const parsedOrder: string[] = JSON.parse(savedOrder);
        this.overviewColumnOrder = parsedOrder.filter(k => this.overviewColumnDefs.some(d => d.key === k));
        const missing = this.overviewColumnDefs.map(d => d.key).filter(k => !this.overviewColumnOrder.includes(k));
        this.overviewColumnOrder.push(...missing);
      } catch {}
    }
  }

  private saveOverviewVisibilityForTf(tf: string) {
    const visKey = `overviewColumnVisibility_${tf}`;
    const orderKey = `overviewColumnOrder_${tf}`;
    localStorage.setItem(visKey, JSON.stringify(this.overviewColumnVisibility));
    localStorage.setItem(orderKey, JSON.stringify(this.overviewColumnOrder));
  }

  private saveOverviewColumnVisibility() {
    this.saveOverviewVisibilityForTf(this.selectedTimeframe);
    this.savePreferencesToBackend();
  }

  exportOverviewToCsv() {
    const data = this.marketData.slice(0, 12);
    if (!data || data.length === 0) return;

    const visibleCols = this.getOrderedVisibleOverviewColumns();
    if (visibleCols.length === 0) return;

    const headers = visibleCols.map(c => c.label);
    const csvRows: string[] = [headers.join(',')];

    data.forEach((row: any) => {
      const values = visibleCols.map(col => {
        let val: any;
        if (col.key === 'time') val = row.time;
        else if (col.key === 'open') val = row.open;
        else if (col.key === 'high') val = row.high;
        else if (col.key === 'low') val = row.low;
        else if (col.key === 'close') val = row.close;
        else if (col.key === 'vol') val = row.tickVolume ? (row.tickVolume / 1000) + 'k' : '';
        else val = '';
        const str = val == null ? '' : String(val);
        if (str.includes(',') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `XAUUSD_${this.selectedTimeframe}_overview_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  copyVisibleToClipboard(view: 'grid' | 'overview') {
    let headers: string[] = [];
    let rowsData: any[] = [];
    const tf = this.selectedTimeframe;

    if (view === 'grid') {
      const cols = this.getOrderedVisibleGridColumns();
      headers = cols.map(c => c.label);
      rowsData = this.gridData.map((row: any) => {
        return cols.map(col => {
          let val: any;
          switch (col.key) {
            case 'broker': val = row.time; break;
            case 'ny': val = row.nyTime; break;
            case 'ist': val = row.istTime; break;
            case 'open': val = row.open; break;
            case 'high': val = row.high; break;
            case 'low': val = row.low; break;
            case 'close': val = row.close; break;
            case 'rsi': val = row.rsi; break;
            default: val = '';
          }
          return val != null ? String(val) : '';
        });
      });
    } else {
      const cols = this.getOrderedVisibleOverviewColumns();
      headers = cols.map(c => c.label);
      const data = this.marketData.slice(0, 12);
      rowsData = data.map((row: any) => {
        return cols.map(col => {
          let val: any;
          if (col.key === 'time') val = row.time;
          else if (col.key === 'open') val = row.open;
          else if (col.key === 'high') val = row.high;
          else if (col.key === 'low') val = row.low;
          else if (col.key === 'close') val = row.close;
          else if (col.key === 'vol') val = row.tickVolume ? (row.tickVolume / 1000) + 'k' : '';
          else val = '';
          return val != null ? String(val) : '';
        });
      });
    }

    const tsv = [headers.join('\t'), ...rowsData.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      // Simple feedback
      const origTitle = document.title;
      document.title = 'Copied!';
      setTimeout(() => document.title = origTitle, 1500);
    }).catch(() => {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = tsv;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }

  loadPreferencesFromBackend() {
    this.http.get<any>(`${environment.apiUrl}/auth/preferences`).subscribe({
      next: (res) => {
        if (res && res.preferences) {
          try {
            const prefs = JSON.parse(res.preferences || '{}');
            const tf = this.selectedTimeframe;
            if (prefs.grid && prefs.grid[tf]) {
              const g = prefs.grid[tf];
              if (g.visibility) this.gridColumnVisibility = { ...this.gridColumnVisibility, ...g.visibility };
              if (g.order && Array.isArray(g.order)) this.gridColumnOrder = g.order.filter((k: string) => this.gridColumnDefs.some(d => d.key === k)) || this.gridColumnOrder;
            }
            if (prefs.overview && prefs.overview[tf]) {
              const o = prefs.overview[tf];
              if (o.visibility) this.overviewColumnVisibility = { ...this.overviewColumnVisibility, ...o.visibility };
              if (o.order && Array.isArray(o.order)) this.overviewColumnOrder = o.order.filter((k: string) => this.overviewColumnDefs.some(d => d.key === k)) || this.overviewColumnOrder;
            }
            if (prefs.health) {
              this.healthTfVisibility = { ...this.healthTfVisibility, ...prefs.health };
            }
          } catch (e) { console.warn('Failed to parse backend prefs'); }
        }
      }
    });
  }

  savePreferencesToBackend() {
    const tf = this.selectedTimeframe;
    const prefs: any = {
      grid: {},
      overview: {},
      health: this.healthTfVisibility
    };
    prefs.grid[tf] = {
      visibility: this.gridColumnVisibility,
      order: this.gridColumnOrder
    };
    prefs.overview[tf] = {
      visibility: this.overviewColumnVisibility,
      order: this.overviewColumnOrder
    };
    this.http.put(`${environment.apiUrl}/auth/preferences`, { preferences: JSON.stringify(prefs) }).subscribe({
      error: () => {} // fail silent for now
    });
  }

  private calculatePriceChange() {
    if (this.marketData.length < 2) {
      this.priceChange = 0;
      return;
    }
    const current = this.marketData[this.marketData.length - 1].close;
    const previous = this.marketData[this.marketData.length - 2].close;
    this.priceChange = ((current - previous) / previous) * 100;
  }

  // Health dashboard helpers - easy to understand status
  isFresh(tf: string): boolean {
    const detail = this.syncStatus[tf];
    if (!detail) return false;
    // Prefer backend-computed fresh flag (from /health real thresholds)
    if (typeof detail.fresh === 'boolean') {
      return detail.fresh;
    }
    if (!detail.lastCandleTime) return false;
    const last = new Date(detail.lastCandleTime);
    const ageMs = Date.now() - last.getTime();
    // Consider fresh based on timeframe (fallback / client calc)
    const thresholds: { [key: string]: number } = {
      'M1': 2 * 60 * 1000,   // 2 min
      'M5': 7 * 60 * 1000,
      'M15': 20 * 60 * 1000,
      'H1': 70 * 60 * 1000,
      'H4': 4.5 * 60 * 60 * 1000,
      'D1': 25 * 60 * 60 * 1000
    };
    return ageMs < (thresholds[tf] || 60 * 60 * 1000);
  }

  timeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }

  private getFallbackMarketData(): any[] {
    // Fallback demo data when backend/market endpoint is unavailable
    // Generates ~20 recent-looking candles for the selected timeframe
    const now = new Date();
    const intervalMs = this.selectedTimeframe === 'D1' ? 86400000 :
                       this.selectedTimeframe === 'H4' ? 14400000 :
                       this.selectedTimeframe === 'H1' ? 3600000 : 900000; // 15m default

    return Array.from({ length: 20 }, (_, i) => {
      const t = new Date(now.getTime() - (19 - i) * intervalMs);
      const base = 2650 + Math.sin(i / 2.5) * 40 + (Math.random() - 0.5) * 8;
      const o = base - 3;
      const c = base + (Math.random() - 0.5) * 6;
      const nyOffset = -4 * 3600 * 1000;      // rough NY (EDT approx)
      const istOffset = 5.5 * 3600 * 1000;    // IST

      return {
        time: t.toISOString(),
        nyTime: new Date(t.getTime() + nyOffset).toISOString(),
        istTime: new Date(t.getTime() + istOffset).toISOString(),
        open: o,
        high: Math.max(o, c) + 4,
        low: Math.min(o, c) - 4,
        close: c,
        tickVolume: 7500 + Math.floor(Math.random() * 5000),
        spread: 10 + Math.floor(Math.random() * 8),
        realVolume: 0
      };
    });
  }

  private renderMarketChart() {
    if (!this.marketChartCanvas || this.marketData.length === 0) return;

    const ctx = this.marketChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.marketChart) {
      this.marketChart.destroy();
    }

    // Reverse for chart so time goes left(old) to right(new) - standard UX
    const chartData = [...this.marketData].reverse();
    const labels = chartData.map(d => format(new Date(d.time), 'MMM dd HH:mm'));
    const closes = chartData.map(d => d.close);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Close Price',
          data: closes,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // Using any here to avoid complex Chart.js generic 'this' / registry type mismatches
              // that commonly appear in Angular + strict TypeScript setups.
              label: (context: any) => `Close: ${context.raw}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#f3f4f6' },
            ticks: { color: '#6b7280', maxRotation: 45, font: { size: 10 } }
          },
          y: {
            grid: { color: '#f3f4f6' },
            ticks: { color: '#6b7280', font: { size: 10 } }
          }
        },
        elements: {
          line: { borderJoinStyle: 'round' }
        }
      }
    };

    this.marketChart = new Chart(ctx, config);
  }

  getCandleColor(candle: any): string {
    return candle.close >= candle.open ? 'text-emerald-600' : 'text-red-600';
  }

  ngOnDestroy() {
    if (this.expirationInterval) {
      clearInterval(this.expirationInterval);
    }
    if (this.marketChart) {
      this.marketChart.destroy();
    }
    // Persist current visibility state
    this.saveGridVisibilityForTf(this.selectedTimeframe);
    this.saveOverviewVisibilityForTf(this.selectedTimeframe);
    this.savePreferencesToBackend();
  }
}
