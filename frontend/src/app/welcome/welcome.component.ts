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
    <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20 md:pb-0">
      <!-- Top Navigation (Desktop / Tablet) -->
      <nav class="bg-white shadow-sm sticky top-0 z-50 hidden md:block">
        <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <span class="text-white font-bold text-xl">G</span>
            </div>
            <span class="font-semibold text-2xl tracking-tight">Grok Dev</span>
          </div>
          
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-sm text-gray-600">Welcome back,</div>
              <div class="font-semibold text-gray-900">{{ currentUser?.username || 'User' }}</div>
            </div>
            <button 
              (click)="logout()"
              class="px-5 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-2xl text-sm font-semibold transition active:scale-[0.98]">
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <!-- Welcome Content -->
      <div class="max-w-6xl mx-auto px-5 pt-8 pb-8">
        <!-- Hero - Responsive text sizes -->
        <div class="text-center mb-10">
          <div class="inline-block px-3.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-3">
            JWT Secured • Spring Boot + Angular
          </div>
          <h1 class="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tighter mb-3">
            Welcome to Grok Dev
          </h1>
          <p class="text-xl text-gray-600 max-w-sm mx-auto">
            {{ welcomeMessage }}
          </p>
        </div>

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

          <!-- Timeframe Pills - Thumb friendly, horizontal scroll on phone -->
          <div class="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1 snap-x">
            <button *ngFor="let tf of timeframes"
                    (click)="selectTimeframe(tf)"
                    class="px-5 py-2.5 text-sm font-semibold rounded-2xl border transition-all active:scale-[0.985] snap-start min-w-[56px] text-center"
                    [class.bg-blue-600]="selectedTimeframe === tf"
                    [class.text-white]="selectedTimeframe === tf"
                    [class.border-blue-600]="selectedTimeframe === tf"
                    [class.bg-white]="selectedTimeframe !== tf"
                    [class.text-gray-700]="selectedTimeframe !== tf"
                    [class.border-gray-200]="selectedTimeframe !== tf">
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

          <!-- Latest Price Hero Card - Big, at-a-glance (mobile perfect) -->
          <div *ngIf="latestCandle" class="bg-white border rounded-3xl p-5 mb-4 shadow-sm">
            <div class="flex justify-between items-start">
              <div>
                <div class="text-sm text-gray-500">Latest Close • {{ selectedTimeframe }}</div>
                <div class="text-4xl sm:text-5xl font-bold tracking-tighter mt-1" [class.text-emerald-600]="priceChange >= 0" [class.text-red-600]="priceChange < 0">
                  {{ latestCandle.close | number:'1.2-2' }}
                </div>
              </div>
              <div class="text-right">
                <div class="inline-flex items-center px-3 py-1 rounded-2xl text-sm font-semibold"
                     [class.bg-emerald-100]="priceChange >= 0" [class.text-emerald-700]="priceChange >= 0"
                     [class.bg-red-100]="priceChange < 0" [class.text-red-700]="priceChange < 0">
                  {{ priceChange >= 0 ? '+' : '' }}{{ priceChange | number:'1.2-2' }}%
                </div>
                <div class="text-[10px] text-gray-500 mt-1">{{ latestCandle.time | date:'MMM dd, HH:mm' }}</div>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-4 gap-2 text-xs">
              <div><span class="text-gray-500">O</span> {{ latestCandle.open | number:'1.2-2' }}</div>
              <div><span class="text-gray-500">H</span> {{ latestCandle.high | number:'1.2-2' }}</div>
              <div><span class="text-gray-500">L</span> {{ latestCandle.low | number:'1.2-2' }}</div>
              <div><span class="text-gray-500">C</span> {{ latestCandle.close | number:'1.2-2' }}</div>
            </div>
          </div>

          <!-- Chart - Rich visual (responsive height) -->
          <div class="bg-white border rounded-3xl p-3 mb-4 shadow-sm">
            <div class="h-52 sm:h-64 relative">
              <canvas #marketChartCanvas></canvas>
              <div *ngIf="isMarketLoading" class="absolute inset-0 flex items-center justify-center bg-white/70 rounded-3xl">
                <div class="animate-pulse text-blue-600">Loading chart...</div>
              </div>
            </div>
          </div>

          <!-- Data Table / Cards - Mobile first responsive -->
          <div class="bg-white border rounded-3xl overflow-hidden shadow-sm">
            <div class="px-4 py-3 border-b flex items-center justify-between bg-gray-50 text-xs font-medium text-gray-500">
              <span>Recent Candles</span>
              <span class="hidden sm:inline">OHLC + Volume</span>
            </div>
            
            <!-- Desktop Table -->
            <table class="hidden md:table w-full text-sm">
              <thead>
                <tr class="border-b text-gray-500 text-xs">
                  <th class="text-left py-2 px-4 font-medium">Time</th>
                  <th class="text-right py-2 px-2 font-medium">Open</th>
                  <th class="text-right py-2 px-2 font-medium">High</th>
                  <th class="text-right py-2 px-2 font-medium">Low</th>
                  <th class="text-right py-2 px-2 font-medium">Close</th>
                  <th class="text-right py-2 px-4 font-medium">Vol</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let candle of marketData.slice().reverse().slice(0, 12)" class="border-b last:border-0 hover:bg-gray-50 active:bg-gray-100">
                  <td class="px-4 py-2.5 font-mono text-xs text-gray-600">{{ candle.time | date:'MMM dd HH:mm' }}</td>
                  <td class="px-2 py-2.5 text-right font-mono" [ngClass]="getCandleColor(candle)">{{ candle.open | number:'1.2-2' }}</td>
                  <td class="px-2 py-2.5 text-right font-mono text-emerald-600">{{ candle.high | number:'1.2-2' }}</td>
                  <td class="px-2 py-2.5 text-right font-mono text-red-600">{{ candle.low | number:'1.2-2' }}</td>
                  <td class="px-2 py-2.5 text-right font-mono font-semibold" [ngClass]="getCandleColor(candle)">{{ candle.close | number:'1.2-2' }}</td>
                  <td class="px-4 py-2.5 text-right font-mono text-xs text-gray-500">{{ (candle.tickVolume / 1000) | number:'1.0-0' }}k</td>
                </tr>
              </tbody>
            </table>

            <!-- Mobile Cards - Enriched, large tap targets, easy scroll -->
            <div class="md:hidden divide-y">
              <div *ngFor="let candle of marketData.slice().reverse().slice(0, 8)" 
                   class="p-4 active:bg-gray-50 flex flex-col gap-1.5">
                <div class="flex justify-between items-baseline text-sm">
                  <span class="font-mono text-gray-500">{{ candle.time | date:'MMM dd, HH:mm' }}</span>
                  <span class="font-semibold text-base" [ngClass]="getCandleColor(candle)">
                    {{ candle.close | number:'1.2-2' }}
                  </span>
                </div>
                <div class="grid grid-cols-4 gap-1 text-[11px] font-mono">
                  <div class="text-center"><div class="text-gray-400">O</div>{{ candle.open | number:'1.2-2' }}</div>
                  <div class="text-center"><div class="text-gray-400">H</div><span class="text-emerald-600">{{ candle.high | number:'1.2-2' }}</span></div>
                  <div class="text-center"><div class="text-gray-400">L</div><span class="text-red-600">{{ candle.low | number:'1.2-2' }}</span></div>
                  <div class="text-center"><div class="text-gray-400">Vol</div>{{ (candle.tickVolume / 1000) | number:'1.0-0' }}k</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Projects Grid - Responsive columns -->
        <div class="mb-10">
          <div class="flex items-center justify-between mb-4 px-1">
            <h2 class="text-2xl font-semibold text-gray-800">Active Projects</h2>
            <span class="text-xs bg-white px-3 py-1 rounded-full border text-gray-500">{{ projects.length }} items</span>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" *ngIf="projects.length > 0; else noProjects">
            <div *ngFor="let project of projects" 
                 class="bg-white rounded-3xl shadow-sm p-6 border border-gray-100 hover:shadow transition-all active:scale-[0.985]">
              <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-xl leading-tight pr-4">{{ project.title }}</h3>
                <span class="text-[10px] font-medium px-3 py-px rounded-full whitespace-nowrap" 
                      [ngClass]="{'bg-emerald-100 text-emerald-700': project.status === 'ACTIVE', 
                                  'bg-amber-100 text-amber-700': project.status === 'IN_PROGRESS',
                                  'bg-slate-100 text-slate-700': project.status === 'PLANNED'}">
                  {{ project.status }}
                </span>
              </div>
              <p class="text-gray-600 text-[15px] leading-relaxed">{{ project.description }}</p>
            </div>
          </div>
          <ng-template #noProjects>
            <div class="bg-white rounded-3xl p-8 text-center border">Loading demo projects...</div>
          </ng-template>
        </div>

        <!-- Session Info -->
        <div class="bg-white border rounded-2xl p-6 text-sm mb-6">
          <div class="flex justify-between items-center">
            <div>
              <p class="font-medium">Current Session</p>
              <p class="text-gray-500 text-xs mt-1">{{ expirationInfo || 'Session active' }}</p>
            </div>
            <button (click)="refreshManually()" 
                    class="text-xs px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium active:scale-95">
              Refresh Token
            </button>
          </div>
        </div>

        <!-- Role-based UI (Admin only) -->
        <div *ngIf="isAdmin()" class="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-6">
          <h3 class="font-semibold text-yellow-800 mb-2">🔐 Admin Panel</h3>
          <p class="text-sm text-yellow-700 mb-3">This section is only visible to users with ROLE_ADMIN.</p>
          <button class="px-4 py-2 bg-yellow-600 text-white rounded-xl text-sm font-medium hover:bg-yellow-700 active:scale-95">
            Manage Users (Demo)
          </button>
        </div>
      </div>

      <!-- Bottom Navigation for Mobile (Realme P2 Pro) -->
      <div class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50 px-1 py-1 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <div class="flex justify-around items-center text-xs font-medium">
          <div class="flex flex-col items-center py-1 px-4 text-blue-600">
            <span class="text-xl mb-px">🏠</span>
            <span>Home</span>
          </div>
          <div class="flex flex-col items-center py-1 px-4 text-gray-500">
            <span class="text-xl mb-px">📊</span>
            <span>Projects</span>
          </div>
          <div (click)="logout()" class="flex flex-col items-center py-1 px-4 text-gray-500 active:text-red-600">
            <span class="text-xl mb-px">🚪</span>
            <span>Logout</span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class WelcomeComponent implements OnInit, OnDestroy, AfterViewInit {
  currentUser: any = null;
  welcomeMessage = 'Your modern full-stack application is ready.';
  projects: any[] = [];
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
  private marketChart?: Chart;

  @ViewChild('marketChartCanvas') marketChartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    
    // Proactively ensure valid session (in case access token expired while app was closed)
    this.authService.ensureValidSession();

    // Role-based UI using service (populated after login)
    this.isAdminUser = this.authService.hasRole('ROLE_ADMIN');

    // Refresh roles from /me (login may have set basic user; /me provides accurate roles)
    this.http.get<any>(`${environment.apiUrl}/auth/me`).subscribe({
      next: (me) => {
        const u = this.authService.getCurrentUser() || { username: me.username };
        localStorage.setItem('currentUser', JSON.stringify({ username: u.username, roles: me.roles || [] }));
        this.currentUser = this.authService.getCurrentUser();
        this.isAdminUser = this.authService.hasRole('ROLE_ADMIN');
      },
      error: () => { /* ignore, fallback to whatever is stored */ }
    });

    // Proper service call after login
    this.loadWelcomeData();
    this.loadProjects();

    // Start live countdown for token expiration
    this.startLiveCountdown();

    // Load market data - core feature for traders (mobile-first)
    this.loadMarketData();
  }

  ngAfterViewInit() {
    // Chart will render after data loads
  }

  private loadWelcomeData() {
    this.http.get<any>(`${environment.apiUrl}/welcome`).subscribe({
      next: (data) => {
        this.welcomeMessage = data.message || this.welcomeMessage;
      },
      error: (err) => {
        console.error('Welcome API error:', err);
        this.welcomeMessage = 'Welcome! (Backend data unavailable)';
      }
    });
  }

  private loadProjects() {
    this.http.get<any[]>(`${environment.apiUrl}/projects/active`).subscribe({
      next: (data) => {
        this.projects = data || [];
      },
      error: (err) => {
        console.error('Projects API error:', err);
        // Fallback dummy data
        this.projects = [
          { title: 'Grok Dev Platform', description: 'Core full-stack with JWT', status: 'ACTIVE' },
          { title: 'Mobile Refactor', description: 'Realme devices support', status: 'IN_PROGRESS' }
        ];
      }
    });
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
  }

  selectTimeframe(tf: string) {
    if (this.selectedTimeframe === tf) return;
    this.selectedTimeframe = tf;
    this.marketChart?.destroy();
    this.loadMarketData();
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

    const labels = this.marketData.map(d => format(new Date(d.time), 'MMM dd HH:mm'));
    const closes = this.marketData.map(d => d.close);

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
