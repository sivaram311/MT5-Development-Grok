import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      <!-- Subtle background pattern -->
      <div class="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] bg-[length:4px_4px] opacity-50"></div>
      
      <div class="relative w-full max-w-md">
        <!-- Brand -->
        <div class="flex items-center justify-center gap-3 mb-10">
          <div class="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-inner">
            <span class="text-zinc-900 font-semibold text-3xl tracking-tighter">G</span>
          </div>
          <div>
            <div class="text-white font-semibold text-3xl tracking-tight">Grok Dev</div>
            <div class="text-zinc-500 text-sm -mt-1">Trading Intelligence</div>
          </div>
        </div>

        <!-- Card -->
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          <div class="mb-8">
            <h1 class="text-white text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p class="text-zinc-400 mt-1.5 text-sm">Sign in to access your market data platform</p>
          </div>

          <form (ngSubmit)="onLogin()" #loginForm="ngForm" class="space-y-5">
            <!-- Username -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5 tracking-widest">USERNAME</label>
              <input 
                type="text" 
                [(ngModel)]="username" 
                name="username" 
                required
                autocomplete="username"
                class="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 text-white placeholder:text-zinc-600 px-4 py-3.5 rounded-2xl text-base outline-none transition-all"
                placeholder="admin">
            </div>

            <!-- Password -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5 tracking-widest">PASSWORD</label>
              <input 
                type="password" 
                [(ngModel)]="password" 
                name="password" 
                required
                autocomplete="current-password"
                class="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 text-white placeholder:text-zinc-600 px-4 py-3.5 rounded-2xl text-base outline-none transition-all"
                placeholder="••••••••">
            </div>

            <!-- Error -->
            <div *ngIf="errorMessage" class="text-red-400 text-sm bg-red-950/50 border border-red-900/50 p-3 rounded-2xl">
              {{ errorMessage }}
            </div>

            <!-- Actions -->
            <div class="pt-2">
              <button 
                type="submit" 
                [disabled]="isLoading || !loginForm.form.valid"
                class="w-full h-12 bg-white hover:bg-zinc-100 active:bg-white disabled:bg-zinc-700 text-zinc-900 disabled:text-zinc-400 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 text-sm tracking-[-0.2px]">
                <span *ngIf="!isLoading">Sign in</span>
                <span *ngIf="isLoading" class="flex items-center gap-2">
                  <span class="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></span>
                  Signing in...
                </span>
              </button>
            </div>
          </form>
        </div>

        <!-- Demo hint -->
        <div class="mt-6 text-center">
          <div class="inline-flex items-center gap-2 text-[10px] px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-500">
            <span>Demo:</span> 
            <span class="font-mono text-emerald-400">admin / admin123</span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onLogin() {
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter username and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Success if we received an accessToken (actual shape from /login)
        if (response && response.accessToken) {
          this.router.navigate(['/welcome']);
        } else {
          this.errorMessage = response?.message || 'Login failed';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Invalid credentials. Please try again.';
      }
    });
  }
}
