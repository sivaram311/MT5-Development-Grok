import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: \
    <div class="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col">
      <!-- Top Bar -->
      <header class="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl">
        <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
                <span class="text-zinc-950 font-bold text-xl tracking-[-1.5px]">G</span>
              </div>
              <div>
                <span class="font-semibold text-xl tracking-tight">Grok Dev</span>
                <span class="ml-1.5 text-[10px] px-1.5 py-px rounded bg-zinc-800 text-zinc-400 font-medium">PRO</span>
              </div>
            </div>
            <button (click)="toggleSidebar()" class="md:hidden p-2 text-xl">?</button>
          </div>

          <div class="flex items-center gap-3">
            <div class="hidden sm:flex items-center bg-zinc-900 rounded-2xl p-0.5 text-xs">
              <button *ngFor="let tf of ['D1','H4','H1','M15','M5','M1']" 
                      class="px-3 py-1 rounded-[14px] font-medium transition">
                {{ tf }}
              </button>
            </div>

            <div class="flex items-center gap-2 pl-3 border-l border-zinc-800">
              <div class="text-right hidden md:block">
                <div class="text-sm font-medium">{{ currentUser?.username }}</div>
                <div class="text-[10px] text-emerald-400 -mt-0.5">online</div>
              </div>
              <div class="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-xs font-semibold border border-zinc-700">
                {{ (currentUser?.username || 'U')[0].toUpperCase() }}
              </div>
              <button (click)="logout()" class="text-xs px-3 py-1.5 border border-zinc-700 hover:bg-zinc-900 rounded-2xl transition">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="flex flex-1 max-w-7xl mx-auto w-full">
        <!-- Sidebar -->
        <aside class="hidden md:flex flex-col w-60 border-r border-zinc-800 bg-zinc-950 p-4 text-sm transition-all" [class.w-16]="sidebarCollapsed">
          <button (click)="sidebarCollapsed = !sidebarCollapsed" class="text-xs text-zinc-400 mb-4 text-left">
            {{ sidebarCollapsed ? '? Expand' : '? Collapse' }}
          </button>

          <nav class="space-y-1">
            <a routerLink="overview" routerLinkActive="bg-zinc-900" class="block px-3 py-2 rounded-2xl flex items-center gap-2 hover:bg-zinc-900">
              <span>??</span> <span *ngIf="!sidebarCollapsed">Overview</span>
            </a>
            <a routerLink="market" routerLinkActive="bg-zinc-900" class="block px-3 py-2 rounded-2xl flex items-center gap-2 hover:bg-zinc-900">
              <span>??</span> <span *ngIf="!sidebarCollapsed">Market Data</span>
            </a>
            <a routerLink="health" routerLinkActive="bg-zinc-900" class="block px-3 py-2 rounded-2xl flex items-center gap-2 hover:bg-zinc-900">
              <span>??</span> <span *ngIf="!sidebarCollapsed">Health</span>
            </a>
            <a routerLink="analysis" routerLinkActive="bg-zinc-900" class="block px-3 py-2 rounded-2xl flex items-center gap-2 hover:bg-zinc-900">
              <span>??</span> <span *ngIf="!sidebarCollapsed">Analysis</span>
            </a>
          </nav>
        </aside>

        <!-- Main -->
        <div class="flex-1 p-6 overflow-auto">
          <router-outlet></router-outlet>
        </div>
      </div>

      <!-- Mobile bottom nav -->
      <div class="md:hidden fixed bottom-0 inset-x-0 bg-zinc-900 border-t border-zinc-800 px-2 py-1 flex justify-around text-xs">
        <a routerLink="overview" class="flex-1 py-2 text-center">Overview</a>
        <a routerLink="market" class="flex-1 py-2 text-center">Market</a>
        <a routerLink="health" class="flex-1 py-2 text-center">Health</a>
        <a routerLink="analysis" class="flex-1 py-2 text-center">Analysis</a>
      </div>
    </div>
  \
})
export class DashboardLayoutComponent {
  sidebarCollapsed = false;
  currentUser: any;

  constructor(private authService: AuthService, private router: Router) {
    this.currentUser = this.authService.getCurrentUser();
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  logout() {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
