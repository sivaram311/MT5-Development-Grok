import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

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
export class WelcomeComponent implements OnInit, OnDestroy {
  currentUser: any = null;
  welcomeMessage = 'Your modern full-stack application is ready.';
  projects: any[] = [];
  expirationInfo: string = '';
  isAdminUser = false;
  private expirationInterval?: ReturnType<typeof setInterval>;

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

  ngOnDestroy() {
    if (this.expirationInterval) {
      clearInterval(this.expirationInterval);
    }
  }
}
