import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';
import { TimeframeContextService } from '../services/timeframe-context.service';
import { SseManagerService } from '../services/sse-manager.service';
import { BottomSheetComponent } from '../ui/bottom-sheet.component';
import { NavIconComponent, NavIconName } from '../ui/nav-icon.component';
import { OfflineBannerComponent } from '../ui/offline-banner.component';
import { PwaUpdateComponent } from '../ui/pwa-update.component';
import { HealthAlertBannerComponent } from '../ui/health-alert-banner.component';
import { GannAlertBannerComponent } from '../ui/gann-alert-banner.component';
import { LiquidityAlertBannerComponent } from '../ui/liquidity-alert-banner.component';

interface NavItem {
  route: string;
  label: string;
  icon: NavIconName;
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, BottomSheetComponent, NavIconComponent, OfflineBannerComponent, PwaUpdateComponent, HealthAlertBannerComponent, GannAlertBannerComponent, LiquidityAlertBannerComponent],
  template: `
    <div class="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col">
      <app-offline-banner></app-offline-banner>
      <app-health-alert-banner></app-health-alert-banner>
      <app-gann-alert-banner></app-gann-alert-banner>
      <app-liquidity-alert-banner></app-liquidity-alert-banner>
      <header class="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl pt-[var(--safe-top)]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 bg-white rounded-xl flex items-center justify-center shrink-0" aria-hidden="true">
              <span class="text-zinc-950 font-bold text-lg tracking-tight">G</span>
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-lg sm:text-xl tracking-tight truncate">Grok Dev</div>
              <div class="text-[10px] text-zinc-500 -mt-0.5 hidden mobile:block">XAUUSD · {{ activeTimeframe }}</div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[10px] px-2 py-1 rounded-full bg-zinc-800 border border-zinc-700 font-semibold tablet:hidden" aria-label="Active timeframe">{{ activeTimeframe }}</span>
            <div class="text-right hidden tablet:block mr-1">
              <div class="text-sm font-medium">{{ currentUser?.username }}</div>
              <div class="text-[10px] text-emerald-400 -mt-0.5">online</div>
            </div>
            <div class="w-9 h-9 bg-zinc-800 rounded-full flex items-center justify-center text-xs font-semibold border border-zinc-700">
              {{ (currentUser?.username || 'U')[0].toUpperCase() }}
            </div>
            <button
              type="button"
              (click)="logout()"
              class="hidden sm:inline-flex min-h-11 text-xs px-3 border border-zinc-700 active:bg-zinc-900 rounded-2xl transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div class="flex flex-1 max-w-7xl mx-auto w-full">
        <aside
          class="hidden tablet:flex flex-col w-56 border-r border-zinc-800 bg-zinc-950 p-4 text-sm transition-all shrink-0"
          [class.w-16]="sidebarCollapsed">
          <button
            type="button"
            (click)="sidebarCollapsed = !sidebarCollapsed"
            class="text-xs text-zinc-400 mb-4 text-left min-h-11 px-2 rounded-xl active:bg-zinc-900">
            {{ sidebarCollapsed ? '→ Expand' : '← Collapse' }}
          </button>

          <nav class="space-y-1" aria-label="Sidebar navigation">
            <a
              *ngFor="let item of sidebarItems"
              [routerLink]="item.route"
              routerLinkActive="bg-zinc-900 text-white"
              [routerLinkActiveOptions]="{ exact: item.route === 'overview' }"
              class="flex items-center gap-2 px-3 py-2.5 min-h-11 rounded-2xl text-zinc-400 active:bg-zinc-900 transition-colors">
              <app-nav-icon class="w-5 h-5 shrink-0" [name]="item.icon"></app-nav-icon>
              <span *ngIf="!sidebarCollapsed">{{ item.label }}</span>
            </a>
            <a
              routerLink="docs"
              routerLinkActive="bg-zinc-900 text-white"
              class="flex items-center gap-2 px-3 py-2.5 min-h-11 rounded-2xl text-zinc-400 active:bg-zinc-900">
              <app-nav-icon class="w-5 h-5 shrink-0" name="docs"></app-nav-icon>
              <span *ngIf="!sidebarCollapsed">Docs</span>
            </a>
            <a
              routerLink="analysis"
              routerLinkActive="bg-zinc-900 text-white"
              class="flex items-center gap-2 px-3 py-2.5 min-h-11 rounded-2xl text-zinc-400 active:bg-zinc-900">
              <app-nav-icon class="w-5 h-5 shrink-0" name="analysis"></app-nav-icon>
              <span *ngIf="!sidebarCollapsed">Analysis</span>
            </a>
          </nav>

          <div class="mt-auto pt-6 text-[10px] text-zinc-600" *ngIf="!sidebarCollapsed">
            Realme P2 Pro · Pad 2
          </div>
        </aside>

        <main class="flex-1 px-4 py-5 sm:p-6 overflow-auto dashboard-main w-full min-w-0">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- Mobile bottom nav: 4 primary + More -->
      <nav
        class="tablet:hidden fixed bottom-0 inset-x-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 mobile-bottom-nav"
        aria-label="Primary navigation">
        <div class="flex justify-around items-stretch px-1 pt-1">
            <a
              *ngFor="let item of primaryNav"
              [routerLink]="item.route"
              routerLinkActive="text-emerald-400"
              [routerLinkActiveOptions]="{ exact: item.route === 'overview' }"
              #rla="routerLinkActive"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              class="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-11 py-1.5 text-[10px] font-medium text-zinc-500 active:text-emerald-300 transition-colors">
            <app-nav-icon class="w-6 h-6" [name]="item.icon"></app-nav-icon>
            <span class="nav-label">{{ item.label }}</span>
          </a>
          <button
            type="button"
            (click)="moreSheetOpen = true"
            aria-label="More navigation options"
            class="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-11 py-1.5 text-[10px] font-medium text-zinc-500 active:text-emerald-300">
            <app-nav-icon class="w-6 h-6" name="more"></app-nav-icon>
            <span class="nav-label">More</span>
          </button>
        </div>
      </nav>

      <app-pwa-update></app-pwa-update>

      <app-bottom-sheet [open]="moreSheetOpen" title="More" (close)="moreSheetOpen = false">
        <div class="space-y-1 pb-2">
          <a
            routerLink="volatility"
            (click)="moreSheetOpen = false"
            class="flex items-center gap-3 min-h-11 px-3 rounded-2xl active:bg-zinc-800 text-sm">
            <app-nav-icon class="w-5 h-5 text-zinc-400" name="volatility"></app-nav-icon>
            Volatility
          </a>
          <a
            routerLink="gann-intraday"
            (click)="moreSheetOpen = false"
            class="flex items-center gap-3 min-h-11 px-3 rounded-2xl active:bg-zinc-800 text-sm">
            <app-nav-icon class="w-5 h-5 text-zinc-400" name="gann-intraday"></app-nav-icon>
            Gann Intraday
          </a>
          <a
            routerLink="ny-liquidity-sweep"
            (click)="moreSheetOpen = false"
            class="flex items-center gap-3 min-h-11 px-3 rounded-2xl active:bg-zinc-800 text-sm">
            <app-nav-icon class="w-5 h-5 text-zinc-400" name="liquidity"></app-nav-icon>
            NY Liquidity
          </a>
          <a
            routerLink="analysis"
            (click)="moreSheetOpen = false"
            class="flex items-center gap-3 min-h-11 px-3 rounded-2xl active:bg-zinc-800 text-sm">
            <app-nav-icon class="w-5 h-5 text-zinc-400" name="analysis"></app-nav-icon>
            Analysis Lab
          </a>
          <a
            routerLink="docs"
            (click)="moreSheetOpen = false"
            class="flex items-center gap-3 min-h-11 px-3 rounded-2xl active:bg-zinc-800 text-sm">
            <app-nav-icon class="w-5 h-5 text-zinc-400" name="docs"></app-nav-icon>
            Technical Docs
          </a>
          <div class="border-t border-zinc-800 my-2"></div>
          <div class="px-3 py-2 text-xs text-zinc-500">
            Signed in as <span class="text-zinc-300 font-medium">{{ currentUser?.username }}</span>
          </div>
          <button
            type="button"
            (click)="logout()"
            class="w-full flex items-center gap-3 min-h-11 px-3 rounded-2xl active:bg-red-950/50 text-sm text-red-400">
            <app-nav-icon class="w-5 h-5" name="logout"></app-nav-icon>
            Logout
          </button>
        </div>
      </app-bottom-sheet>
    </div>
  `
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  moreSheetOpen = false;
  currentUser: any;
  activeTimeframe = 'D1';

  primaryNav: NavItem[] = [
    { route: 'overview', label: 'Home', icon: 'home' },
    { route: 'market', label: 'Market', icon: 'market' },
    { route: 'order-rsi', label: 'Analyzer', icon: 'order-rsi' },
    { route: 'health', label: 'Health', icon: 'health' }
  ];

  sidebarItems: NavItem[] = [
    { route: 'overview', label: 'Overview', icon: 'home' },
    { route: 'market', label: 'Market Data', icon: 'market' },
    { route: 'order-rsi', label: 'Analyzer', icon: 'order-rsi' },
    { route: 'gann-intraday', label: 'Gann Intraday', icon: 'gann-intraday' },
    { route: 'ny-liquidity-sweep', label: 'NY Liquidity', icon: 'liquidity' },
    { route: 'volatility', label: 'Volatility', icon: 'volatility' },
    { route: 'health', label: 'Health', icon: 'health' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private timeframeContext: TimeframeContextService,
    private sseManager: SseManagerService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUser = this.authService.getCurrentUser();
    this.timeframeContext.timeframe$.pipe(takeUntilDestroyed()).subscribe(tf => {
      this.activeTimeframe = tf;
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.sseManager.startDashboard();
  }

  ngOnDestroy(): void {
    this.sseManager.stopDashboard();
  }

  logout() {
    this.moreSheetOpen = false;
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

}
