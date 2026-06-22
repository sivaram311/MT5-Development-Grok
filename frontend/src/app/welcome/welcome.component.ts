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
    <div class="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col">
      <!-- Top Bar -->
      <header class="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl">
        <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <!-- Logo + Sidebar Toggle -->
            <div class="flex items-center gap-3">
              <button (click)="sidebarCollapsed = !sidebarCollapsed" class="md:hidden p-2 -ml-2 text-xl">☰</button>
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
                  <span class="text-zinc-950 font-bold text-xl tracking-[-1.5px]">G</span>
                </div>
                <div>
                  <span class="font-semibold text-xl tracking-tight">Grok Dev</span>
                  <span class="ml-1.5 text-[10px] px-1.5 py-px rounded bg-zinc-800 text-zinc-400 font-medium">PRO</span>
                </div>
              </div>
            </div>

            <!-- Desktop Nav (top for simplicity, or can move to sidebar) -->
            <div class="hidden md:flex items-center gap-1 ml-6 text-sm">
              <button (click)="setSection('overview')"
                      class="px-4 py-1.5 rounded-2xl text-sm font-medium transition-colors"
                      [class.bg-white]="currentSection === 'overview'"
                      [class.text-zinc-950]="currentSection === 'overview'"
                      [class.text-zinc-300]="currentSection !== 'overview'">
                Overview
              </button>
              <button (click)="setSection('market')"
                      class="px-4 py-1.5 rounded-2xl text-sm font-medium transition-colors"
                      [class.bg-white]="currentSection === 'market'"
                      [class.text-zinc-950]="currentSection === 'market'"
                      [class.text-zinc-300]="currentSection !== 'market'">
                Market Data
              </button>
              <button (click)="setSection('health')"
                      class="px-4 py-1.5 rounded-2xl text-sm font-medium transition-colors"
                      [class.bg-white]="currentSection === 'health'"
                      [class.text-zinc-950]="currentSection === 'health'"
                      [class.text-zinc-300]="currentSection !== 'health'">
                Health
              </button>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <!-- Timeframe mini selector -->
            <div class="hidden sm:flex items-center bg-zinc-900 rounded-2xl p-0.5 text-xs">
              <button *ngFor="let tf of timeframes" 
                      (click)="selectTimeframe(tf)"
                      class="px-3 py-1 rounded-[14px] font-medium transition"
                      [class.bg-white]="selectedTimeframe === tf"
                      [class.text-zinc-900]="selectedTimeframe === tf"
                      [class.text-zinc-400]="selectedTimeframe !== tf">
                {{ tf }}
              </button>
            </div>

            <!-- User -->
            <div class="flex items-center gap-2 pl-3 border-l border-zinc-800">
              <div class="text-right hidden md:block">
                <div class="text-sm font-medium">{{ currentUser?.username }}</div>
                <div class="text-[10px] text-emerald-400 -mt-0.5">online</div>
              </div>
              <div class="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-xs font-semibold border border-zinc-700">
                {{ (currentUser?.username || 'U')[0].toUpperCase() }}
              </div>
              <button (click)="logout()" 
                      class="text-xs px-3 py-1.5 border border-zinc-700 hover:bg-zinc-900 rounded-2xl transition">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="flex flex-1 max-w-7xl mx-auto w-full">
        <!-- Sidebar -->
        <aside class="hidden md:flex flex-col w-60 border-r border-zinc-800 bg-zinc-950 p-4 text-sm transition-all"
               [class.w-16]="sidebarCollapsed">
          <div class="mb-6">
            <button (click)="sidebarCollapsed = !sidebarCollapsed" class="text-zinc-400 hover:text-white text-xs">
              {{ sidebarCollapsed ? '→' : '← Collapse' }}
            </button>
          </div>

          <nav class="space-y-1">
            <button (click)="setSection('overview')" 
                    class="w-full text-left px-3 py-2 rounded-2xl flex items-center gap-2 hover:bg-zinc-900"
                    [class.bg-zinc-900]="currentSection === 'overview'">
              <span>📊</span> <span *ngIf="!sidebarCollapsed">Overview</span>
            </button>
            <button (click)="setSection('market')" 
                    class="w-full text-left px-3 py-2 rounded-2xl flex items-center gap-2 hover:bg-zinc-900"
                    [class.bg-zinc-900]="currentSection === 'market'">
              <span>📈</span> <span *ngIf="!sidebarCollapsed">Market Data</span>
            </button>
            <button (click)="setSection('health')" 
                    class="w-full text-left px-3 py-2 rounded-2xl flex items-center gap-2 hover:bg-zinc-900"
                    [class.bg-zinc-900]="currentSection === 'health'">
              <span>❤️</span> <span *ngIf="!sidebarCollapsed">Health</span>
            </button>
          </nav>

          <div class="mt-auto pt-8 text-[10px] text-zinc-500" *ngIf="!sidebarCollapsed">
            <div>Realme optimized</div>
            <div>Modern trading UX</div>
          </div>
        </aside>

        <!-- Main Content -->
        <div class="flex-1 p-6 overflow-auto">

      <!-- Main Container -->
      <div class="max-w-7xl mx-auto px-6 pt-8 pb-12">
        
        <!-- Header -->
        <div class="flex items-end justify-between mb-6">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-3xl font-semibold tracking-tight">XAUUSD Live</h1>
              <div class="px-2.5 py-0.5 text-xs font-medium bg-emerald-900/50 text-emerald-400 rounded-full border border-emerald-800">
                {{ selectedTimeframe }}
              </div>
            </div>
            <p class="text-sm text-zinc-500 mt-0.5">Real-time data from MetaTrader 5 • All timeframes</p>
          </div>

          <div class="flex items-center gap-2">
            <button (click)="refreshMarket()" 
                    class="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 active:bg-zinc-950 rounded-2xl text-sm font-medium transition">
              <span>↻</span> <span>Refresh</span>
            </button>
            <button (click)="toggleDarkMode()" 
                    class="px-3 py-2 text-sm border border-zinc-700 hover:bg-zinc-900 rounded-2xl">
              {{ darkMode ? '☀' : '🌙' }}
            </button>
          </div>
        </div>

        <!-- Timeframe Pills (Mobile friendly) -->
        <div class="flex gap-1.5 overflow-x-auto pb-4 -mx-1 px-1 snap-x scrollbar-hide md:hidden">
          <button *ngFor="let tf of timeframes"
                  (click)="selectTimeframe(tf)"
                  class="px-4 py-1.5 text-sm font-medium rounded-2xl border whitespace-nowrap snap-start"
                  [class.bg-white]="selectedTimeframe === tf"
                  [class.text-zinc-950]="selectedTimeframe === tf"
                  [class.border-white]="selectedTimeframe === tf"
                  [class.bg-zinc-900]="selectedTimeframe !== tf"
                  [class.border-zinc-700]="selectedTimeframe !== tf">
            {{ tf }}
          </button>
        </div>

        <!-- Quick KPI Row -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
            <div class="text-xs text-zinc-500">LATEST CLOSE</div>
            <div class="text-3xl font-semibold tabular-nums mt-1 tracking-tighter" [class.text-emerald-400]="priceChange >= 0" [class.text-red-400]="priceChange < 0">
              {{ latestCandle?.close | number:'1.2-2' || '—' }}
            </div>
            <div class="text-sm" [class.text-emerald-400]="priceChange >= 0" [class.text-red-400]="priceChange < 0">
              {{ priceChange >= 0 ? '+' : '' }}{{ priceChange | number:'1.2-2' }}%
            </div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
            <div class="text-xs text-zinc-500">TIMEFRAME</div>
            <div class="mt-1 text-2xl font-semibold">{{ selectedTimeframe }}</div>
            <div class="text-xs text-zinc-500">{{ marketData.length }} candles loaded</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
            <div class="text-xs text-zinc-500">LAST UPDATE</div>
            <div class="mt-1 font-mono text-lg">{{ latestCandle?.time | date:'HH:mm:ss' || '—' }}</div>
            <div class="text-xs text-zinc-400">Broker time</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 flex items-center justify-between">
            <div>
              <div class="text-xs text-zinc-500">PIPELINE</div>
              <div class="text-lg font-medium" [class.text-emerald-400]="healthStatus.status === 'UP'" [class.text-amber-400]="healthStatus.status === 'DEGRADED'">
                {{ healthStatus.status || '—' }}
              </div>
            </div>
            <button (click)="setSection('health')" class="text-xs px-3 py-1 bg-zinc-800 rounded-2xl">View</button>
          </div>
        </div>

        <!-- Section Content -->
        <div *ngIf="currentSection === 'overview'">
          <!-- Overview Content -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-3 px-1">
              <div class="font-semibold">Recent Candles</div>
              <div class="text-xs text-zinc-500">Last 12 • {{ selectedTimeframe }}</div>
            </div>
            
            <!-- Desktop table -->
            <div class="hidden md:block bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-zinc-800 text-xs text-zinc-400">
                    <th class="text-left py-3 px-5 font-medium">Time</th>
                    <th class="text-right py-3 px-4 font-medium">Open</th>
                    <th class="text-right py-3 px-4 font-medium">High</th>
                    <th class="text-right py-3 px-4 font-medium">Low</th>
                    <th class="text-right py-3 px-4 font-medium">Close</th>
                    <th class="text-right py-3 px-5 font-medium">Vol (k)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let candle of marketData.slice(0, 12)" class="border-b border-zinc-800 last:border-none hover:bg-zinc-800/50 transition-colors">
                    <td class="px-5 py-3 font-mono text-xs text-zinc-400">{{ candle.time | date:'MMM dd HH:mm' }}</td>
                    <td class="px-4 py-3 text-right font-mono" [ngClass]="getCandleColor(candle)">{{ candle.open | number:'1.2-2' }}</td>
                    <td class="px-4 py-3 text-right font-mono text-emerald-400">{{ candle.high | number:'1.2-2' }}</td>
                    <td class="px-4 py-3 text-right font-mono text-red-400">{{ candle.low | number:'1.2-2' }}</td>
                    <td class="px-4 py-3 text-right font-mono font-medium" [ngClass]="getCandleColor(candle)">{{ candle.close | number:'1.2-2' }}</td>
                    <td class="px-5 py-3 text-right font-mono text-xs text-zinc-400">{{ (candle.tickVolume / 1000) | number:'1.0-0' }}k</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div class="md:hidden space-y-2">
              <div *ngFor="let candle of marketData.slice(0, 6)" class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
                <div class="flex justify-between items-baseline">
                  <div class="font-mono text-xs text-zinc-400">{{ candle.time | date:'MMM dd HH:mm' }}</div>
                  <div class="font-semibold text-lg tabular-nums" [ngClass]="getCandleColor(candle)">
                    {{ candle.close | number:'1.2-2' }}
                  </div>
                </div>
                <div class="grid grid-cols-5 gap-2 mt-3 text-center text-xs">
                  <div><div class="text-zinc-500 text-[10px]">O</div>{{ candle.open | number:'1.1-1' }}</div>
                  <div><div class="text-emerald-500 text-[10px]">H</div>{{ candle.high | number:'1.1-1' }}</div>
                  <div><div class="text-red-500 text-[10px]">L</div>{{ candle.low | number:'1.1-1' }}</div>
                  <div><div class="text-zinc-500 text-[10px]">C</div>{{ candle.close | number:'1.1-1' }}</div>
                  <div><div class="text-zinc-500 text-[10px]">VOL</div>{{ (candle.tickVolume / 1000) | number:'1.0-0' }}k</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Market Data Section (Data Grid + Controls) -->
        <div *ngIf="currentSection === 'market'">
          <div class="mb-4 flex items-center justify-between">
            <div class="font-semibold">Data Explorer</div>
            <button (click)="showCustomizeModal = true" 
                    class="text-xs px-3 py-1.5 rounded-2xl border border-zinc-700 hover:bg-zinc-900">
              Customize columns
            </button>
          </div>

          <!-- Column panel (modern) -->
          <div *ngIf="showColumnPanel" class="mb-4 p-4 bg-zinc-900 border border-zinc-800 rounded-3xl">
            <div class="flex items-center justify-between mb-3">
              <div class="text-sm font-medium">Visible Columns</div>
              <div class="flex gap-2 text-xs">
                <button (click)="showAllGridColumns()" class="px-2 py-0.5 bg-emerald-900 text-emerald-300 rounded">Show all</button>
                <button (click)="hideAllGridColumns()" class="px-2 py-0.5 bg-red-900 text-red-300 rounded">Hide all</button>
                <button (click)="applyGridPreset('all')" class="px-2 py-0.5 border border-zinc-600 rounded">Reset</button>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <div *ngFor="let col of gridColumnDefs" 
                   (click)="toggleGridColumn(col.key)"
                   class="px-3 py-1 text-xs rounded-2xl border cursor-pointer transition"
                   [class.bg-white]="isGridColumnVisible(col.key)"
                   [class.text-zinc-950]="isGridColumnVisible(col.key)"
                   [class.border-white]="isGridColumnVisible(col.key)"
                   [class.bg-zinc-800]="!isGridColumnVisible(col.key)"
                   [class.border-zinc-700]="!isGridColumnVisible(col.key)">
                {{ col.label }}
              </div>
            </div>
            <div class="text-[10px] mt-3 text-zinc-400">Drag & drop support available on desktop. Presets coming soon.</div>
          </div>

          <!-- Data Grid Table -->
          <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
            <div class="px-5 py-3 border-b border-zinc-800 text-xs text-zinc-400 flex items-center">
              <span>DATA GRID — {{ selectedTimeframe }}</span>
              <span class="ml-auto">NEWEST FIRST</span>
            </div>
            
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b border-zinc-800 text-[10px] text-zinc-400 bg-zinc-950">
                    <th *ngFor="let col of getOrderedVisibleGridColumns()" class="py-3 px-3 font-medium text-left">
                      {{ col.label }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800">
                  <tr *ngFor="let row of gridData" class="hover:bg-zinc-800/40">
                    <td *ngFor="let col of getOrderedVisibleGridColumns()" class="px-3 py-2.5 font-mono text-xs">
                      <ng-container [ngSwitch]="col.key">
                        <span *ngSwitchCase="'broker'">{{ row.time | date:'MMM dd HH:mm' }}</span>
                        <span *ngSwitchCase="'ny'">{{ row.nyTime | date:'MMM dd HH:mm' }}</span>
                        <span *ngSwitchCase="'ist'">{{ row.istTime | date:'MMM dd HH:mm' }}</span>
                        <span *ngSwitchCase="'open'">{{ row.open | number:'1.2-2' }}</span>
                        <span *ngSwitchCase="'high'">{{ row.high | number:'1.2-2' }}</span>
                        <span *ngSwitchCase="'low'">{{ row.low | number:'1.2-2' }}</span>
                        <span *ngSwitchCase="'close'">{{ row.close | number:'1.2-2' }}</span>
                        <span *ngSwitchCase="'rsi'">
                          <span *ngIf="row.rsi != null" class="px-1.5 py-px rounded text-xs" 
                                [class.bg-emerald-900]="row.rsi > 50" [class.text-emerald-400]="row.rsi > 50"
                                [class.bg-red-900]="row.rsi <= 50" [class.text-red-400]="row.rsi <= 50">
                            {{ row.rsi | number:'1.1-1' }}
                          </span>
                          <span *ngIf="row.rsi == null" class="text-zinc-600">—</span>
                        </span>
                      </ng-container>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex justify-between text-xs">
              <div>{{ gridData.length }} rows</div>
              <button (click)="loadGridData()" class="text-emerald-400 hover:text-emerald-300">Refresh Grid</button>
            </div>
          </div>
        </div>

        <!-- Health Section -->
        <div *ngIf="currentSection === 'health'">
          <div class="mb-4">
            <div class="font-semibold mb-1">Pipeline Health</div>
            <div class="text-xs text-zinc-400">Per-timeframe freshness based on completed candles</div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div *ngFor="let tf of timeframes" 
                 class="bg-zinc-900 border border-zinc-800 rounded-3xl px-4 py-4 text-sm"
                 [class.border-emerald-700]="isFresh(tf)"
                 [class.border-amber-700]="!isFresh(tf)">
              <div class="flex justify-between">
                <div class="font-semibold">{{ tf }}</div>
                <div class="text-xs" [class.text-emerald-400]="isFresh(tf)" [class.text-amber-400]="!isFresh(tf)">
                  {{ isFresh(tf) ? 'FRESH' : timeSince(syncStatus[tf]?.lastCandleTime) }}
                </div>
              </div>
              <div class="font-mono text-lg mt-2 text-zinc-100">
                {{ syncStatus[tf]?.lastCandleTime | date:'HH:mm' || '—' }}
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Column Customization Modal -->
      <div *ngIf="showCustomizeModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" (click)="showCustomizeModal = false">
        <div class="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 w-full max-w-md mx-4" (click)="$event.stopPropagation()">
          <div class="flex justify-between items-center mb-4">
            <div class="font-semibold">Customize Columns</div>
            <button (click)="showCustomizeModal = false" class="text-xl leading-none">×</button>
          </div>

          <div class="space-y-2 max-h-[50vh] overflow-auto pr-2">
            <div *ngFor="let col of gridColumnDefs" 
                 class="flex items-center justify-between px-3 py-2 bg-zinc-800 rounded-2xl">
              <div class="flex items-center gap-2">
                <button (click)="toggleGridColumn(col.key)" 
                        class="px-2 py-0.5 text-xs rounded border"
                        [class.bg-white]="isGridColumnVisible(col.key)"
                        [class.text-zinc-900]="isGridColumnVisible(col.key)">
                  {{ isGridColumnVisible(col.key) ? 'Visible' : 'Hidden' }}
                </button>
                <span>{{ col.label }} ({{ col.title }})</span>
              </div>
              <div class="flex gap-1">
                <button (click)="moveGridColumn(col.key, 'up')" class="px-1 text-sm">↑</button>
                <button (click)="moveGridColumn(col.key, 'down')" class="px-1 text-sm">↓</button>
              </div>
            </div>
          </div>

          <div class="flex gap-2 mt-4">
            <button (click)="showAllGridColumns(); showCustomizeModal = false" class="flex-1 py-2 bg-emerald-900 text-sm rounded-2xl">Show All</button>
            <button (click)="hideAllGridColumns(); showCustomizeModal = false" class="flex-1 py-2 bg-red-900 text-sm rounded-2xl">Hide All</button>
            <button (click)="showCustomizeModal = false" class="flex-1 py-2 border border-zinc-600 rounded-2xl">Close</button>
          </div>
        </div>
      </div>

      <!-- Mobile bottom nav -->
      <div class="md:hidden fixed bottom-0 inset-x-0 bg-zinc-900 border-t border-zinc-800 px-2 py-1 flex justify-around text-xs">
        <div (click)="setSection('overview')" class="flex-1 py-2 text-center" [class.text-white]="currentSection === 'overview'">
          Overview
        </div>
        <div (click)="setSection('market')" class="flex-1 py-2 text-center" [class.text-white]="currentSection === 'market'">
          Market
        </div>
        <div (click)="setSection('health')" class="flex-1 py-2 text-center" [class.text-white]="currentSection === 'health'">
          Health
        </div>
      </div>
    </div>
  `













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
            <ng-container *ngFor="let tf of timeframes">
              <div *ngIf="isHealthTfVisible(tf)"
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
            </ng-container>
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

  // Ensure health visibility is always an object (defensive)
  private ensureHealthVisibility() {
    if (!this.healthTfVisibility || typeof this.healthTfVisibility !== 'object') {
      this.healthTfVisibility = {
        'D1': true, 'H4': true, 'H1': true, 'M15': true, 'M5': true, 'M1': true
      };
    }
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
