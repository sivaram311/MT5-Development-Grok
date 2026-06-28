import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex flex-col bg-zinc-950 text-zinc-200 relative overflow-hidden">
      <!-- Ambient glow -->
      <div class="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true"></div>
      <div class="pointer-events-none absolute bottom-0 right-0 w-72 h-72 rounded-full bg-amber-500/5 blur-3xl" aria-hidden="true"></div>

      <div class="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-14 relative z-10">
        <!-- Brand -->
        <div class="text-center mb-8 sm:mb-10 max-w-sm">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-zinc-200 shadow-lg shadow-black/40 mb-4">
            <span class="text-zinc-900 font-bold text-3xl tracking-tighter">G</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Grok Dev</h1>
          <p class="text-zinc-400 text-sm mt-1.5 leading-relaxed">XAUUSD market data, volatility &amp; pipeline health — optimized for mobile.</p>
        </div>

        <!-- Login card -->
        <div class="w-full max-w-[400px]">
          <div class="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/30">
            <div class="mb-6">
              <h2 class="text-lg font-semibold text-white">Sign in</h2>
              <p class="text-zinc-500 text-sm mt-1">Access your trading dashboard</p>
            </div>

            <div *ngIf="sessionMessage" class="mb-4 flex gap-2.5 text-amber-200 text-sm bg-amber-950/40 border border-amber-800/40 p-3.5 rounded-2xl" role="alert">
              <svg class="w-5 h-5 shrink-0 mt-0.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>{{ sessionMessage }}</span>
            </div>

            <form (ngSubmit)="onLogin()" #loginForm="ngForm" class="space-y-4">
              <div>
                <label for="username" class="block text-sm font-medium text-zinc-300 mb-1.5">Username</label>
                <div class="relative">
                  <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    [(ngModel)]="username"
                    name="username"
                    required
                    autocomplete="username"
                    class="w-full bg-zinc-950/80 border border-zinc-800 focus:border-emerald-600/60 focus:ring-2 focus:ring-emerald-600/20 text-white placeholder:text-zinc-600 pl-11 pr-4 py-3.5 rounded-2xl text-base outline-none transition-all"
                    placeholder="Enter username">
                </div>
              </div>

              <div>
                <label for="password" class="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
                <div class="relative">
                  <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </span>
                  <input
                    id="password"
                    [type]="showPassword ? 'text' : 'password'"
                    [(ngModel)]="password"
                    name="password"
                    required
                    autocomplete="current-password"
                    class="w-full bg-zinc-950/80 border border-zinc-800 focus:border-emerald-600/60 focus:ring-2 focus:ring-emerald-600/20 text-white placeholder:text-zinc-600 pl-11 pr-14 py-3.5 rounded-2xl text-base outline-none transition-all"
                    placeholder="Enter password">
                  <button
                    type="button"
                    (click)="showPassword = !showPassword"
                    class="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center text-xs font-medium text-zinc-400 active:text-zinc-200 rounded-xl"
                    [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'">
                    {{ showPassword ? 'Hide' : 'Show' }}
                  </button>
                </div>
              </div>

              <div *ngIf="errorMessage" class="flex gap-2.5 text-red-300 text-sm bg-red-950/40 border border-red-900/40 p-3.5 rounded-2xl" role="alert">
                <svg class="w-5 h-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>{{ errorMessage }}</span>
              </div>

              <button
                type="submit"
                [disabled]="isLoading || !loginForm.form.valid"
                class="w-full h-12 mt-2 bg-emerald-500 active:bg-emerald-400 disabled:bg-zinc-800 text-zinc-950 disabled:text-zinc-500 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-900/30 disabled:shadow-none">
                <span *ngIf="!isLoading">Continue to dashboard</span>
                <span *ngIf="isLoading" class="flex items-center gap-2">
                  <span class="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin"></span>
                  Signing in…
                </span>
              </button>
            </form>
          </div>

          <div *ngIf="showDemoHint" class="mt-5 text-center space-y-2">
            <div class="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs px-4 py-2.5 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-zinc-500">
              <span>Demo credentials</span>
              <span class="font-mono text-emerald-400/90">admin</span>
              <span class="text-zinc-600">/</span>
              <span class="font-mono text-emerald-400/90">admin123</span>
            </div>
            <button
              type="button"
              (click)="fillDemoCredentials()"
              class="text-xs font-medium text-emerald-400/90 active:text-emerald-300 underline underline-offset-2">
              Use demo credentials
            </button>
          </div>
        </div>
      </div>

      <!-- Footer feature strip -->
      <div class="relative z-10 px-4 pb-8 pt-2 safe-bottom">
        <div class="max-w-md mx-auto flex flex-wrap justify-center gap-2 text-[11px] text-zinc-500">
          <span class="px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800">Live XAUUSD</span>
          <span class="px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800">Offline cache</span>
          <span class="px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800">PWA ready</span>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  showPassword = false;
  isLoading = false;
  errorMessage = '';
  sessionMessage = '';
  showDemoHint = environment.showDemoHint;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      if (params.get('reason') === 'session_expired') {
        this.sessionMessage = 'Your session expired. Please sign in again.';
      }
    });
  }

  fillDemoCredentials() {
    this.username = 'admin';
    this.password = 'admin123';
    this.errorMessage = '';
  }

  onLogin() {
    this.username = this.username.trim();
    this.password = this.password.trim();

    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter username and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.username, this.password).subscribe({
      next: response => {
        this.isLoading = false;
        if (response?.accessToken) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = response?.message || 'Login failed';
        }
      },
      error: err => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Invalid credentials. Please try again.';
      }
    });
  }
}
