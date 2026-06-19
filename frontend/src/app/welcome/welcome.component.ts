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
            </div>
            
            <!-- Desktop Table - Modern styling -->
            <table class="hidden md:table w-full text-sm">
              <thead>
                <tr class="border-b text-[10px] uppercase tracking-widest text-gray-400">
                  <th class="text-left py-2 px-4 font-medium">Time</th>
                  <th class="text-right py-2 px-2 font-medium">Open</th>
                  <th class="text-right py-2 px-2 font-medium">High</th>
                  <th class="text-right py-2 px-2 font-medium">Low</th>
                  <th class="text-right py-2 px-2 font-medium">Close</th>
                  <th class="text-right py-2 px-4 font-medium">Vol</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let candle of marketData.slice(0, 12)" class="border-b last:border-none hover:bg-gray-50/80 transition-colors">
                  <td class="px-4 py-2 font-mono text-xs text-gray-600">{{ candle.time | date:'MMM dd HH:mm' }}</td>
                  <td class="px-2 py-2 text-right font-mono" [ngClass]="getCandleColor(candle)">{{ candle.open | number:'1.2-2' }}</td>
                  <td class="px-2 py-2 text-right font-mono text-emerald-600">{{ candle.high | number:'1.2-2' }}</td>
                  <td class="px-2 py-2 text-right font-mono text-rose-600">{{ candle.low | number:'1.2-2' }}</td>
                  <td class="px-2 py-2 text-right font-mono font-semibold" [ngClass]="getCandleColor(candle)">{{ candle.close | number:'1.2-2' }}</td>
                  <td class="px-4 py-2 text-right font-mono text-xs text-gray-500">{{ (candle.tickVolume / 1000) | number:'1.0-0' }}k</td>
                </tr>
              </tbody>
            </table>

            <!-- Mobile Cards -->
            <div class="md:hidden divide-y text-sm">
              <div *ngFor="let candle of marketData.slice(0, 8)" 
                   class="p-3.5 active:bg-gray-50 flex flex-col gap-y-1">
                <div class="flex justify-between items-baseline">
                  <span class="font-mono text-xs text-gray-500">{{ candle.time | date:'MMM dd HH:mm' }}</span>
                  <span class="font-semibold text-base tabular-nums" [ngClass]="getCandleColor(candle)">
                    {{ candle.close | number:'1.2-2' }}
                  </span>
                </div>
                <div class="grid grid-cols-5 gap-1 text-[11px] font-mono text-center">
                  <div><span class="text-[9px] text-gray-400 block">O</span>{{ candle.open | number:'1.2-2' }}</div>
                  <div><span class="text-[9px] text-emerald-400 block">H</span>{{ candle.high | number:'1.2-2' }}</div>
                  <div><span class="text-[9px] text-rose-400 block">L</span>{{ candle.low | number:'1.2-2' }}</div>
                  <div><span class="text-[9px] text-gray-400 block">C</span>{{ candle.close | number:'1.2-2' }}</div>
                  <div><span class="text-[9px] text-gray-400 block">VOL</span>{{ (candle.tickVolume / 1000) | number:'1.0-0' }}k</div>
                </div>
              </div>
            </div>
          </div>
          </div> <!-- end overview -->

          <!-- Modern Data Grid Tab -->
          <div *ngIf="activeView === 'grid'" class="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
            <div class="px-5 py-3 border-b flex items-center justify-between bg-gray-50/70 text-xs font-semibold text-gray-500 tracking-wider">
              <span>DATA GRID — TIME • OHLC • RSI(14)</span>
              <span class="text-[10px] font-normal">NEWEST FIRST</span>
            </div>

            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b text-[10px] uppercase tracking-[1px] text-gray-400 bg-gray-50">
                    <th class="text-left py-2.5 px-5 font-medium">TIME</th>
                    <th class="text-right py-2.5 px-3 font-medium">OPEN</th>
                    <th class="text-right py-2.5 px-3 font-medium">HIGH</th>
                    <th class="text-right py-2.5 px-3 font-medium">LOW</th>
                    <th class="text-right py-2.5 px-3 font-medium">CLOSE</th>
                    <th class="text-right py-2.5 px-5 font-medium">RSI</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr *ngFor="let row of gridData" class="hover:bg-blue-50/30 transition-colors group">
                    <td class="px-5 py-2.5 font-mono text-xs text-gray-600 group-hover:text-gray-900">{{ row.time | date:'MMM dd HH:mm' }}</td>
                    <td class="px-3 py-2.5 text-right font-mono text-gray-700">{{ row.open | number:'1.2-2' }}</td>
                    <td class="px-3 py-2.5 text-right font-mono text-emerald-600">{{ row.high | number:'1.2-2' }}</td>
                    <td class="px-3 py-2.5 text-right font-mono text-rose-600">{{ row.low | number:'1.2-2' }}</td>
                    <td class="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">{{ row.close | number:'1.2-2' }}</td>
                    <td class="px-5 py-2.5 text-right font-mono">
                      <span *ngIf="row.rsi != null" 
                            class="inline-block min-w-[52px] px-2 py-px rounded font-medium text-xs"
                            [class.bg-emerald-100]="row.rsi > 50" [class.text-emerald-700]="row.rsi > 50"
                            [class.bg-rose-100]="row.rsi <= 50" [class.text-rose-700]="row.rsi <= 50">
                        {{ row.rsi | number:'1.1-1' }}
                      </span>
                      <span *ngIf="row.rsi == null" class="text-gray-300">—</span>
                    </td>
                  </tr>
                  <tr *ngIf="gridData.length === 0 && !isGridLoading">
                    <td colspan="6" class="px-5 py-8 text-center text-sm text-gray-400">No data loaded for this timeframe. Tap refresh.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="px-4 py-3 bg-gray-50 border-t flex items-center justify-between text-xs">
              <div class="text-gray-500">{{ gridData.length }} rows</div>
              <button (click)="loadGridData()" 
                      [disabled]="isGridLoading"
                      class="px-4 py-1 bg-white border text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-2xl font-medium text-xs transition disabled:opacity-60">
                {{ isGridLoading ? 'LOADING...' : 'REFRESH' }}
              </button>
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

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <div *ngFor="let tf of timeframes" 
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
    this.selectedTimeframe = tf;
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
      return {
        time: t.toISOString(),
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
  }
}
