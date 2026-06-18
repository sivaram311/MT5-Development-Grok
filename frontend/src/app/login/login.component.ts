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
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 p-4">
      <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
        <!-- Logo/Header - Larger touch friendly -->
        <div class="text-center mb-8">
          <div class="mx-auto w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-md">
            <span class="text-white text-4xl font-bold">G</span>
          </div>
          <h1 class="text-3xl font-bold text-gray-900">Grok Dev</h1>
          <p class="text-gray-600 mt-2 text-sm">Secure full-stack platform</p>
        </div>

        <form (ngSubmit)="onLogin()" #loginForm="ngForm" class="space-y-5">
          <!-- Username -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
            <input 
              type="text" 
              [(ngModel)]="username" 
              name="username" 
              required
              class="w-full px-5 py-3.5 text-lg border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-0 transition-all bg-gray-50"
              placeholder="admin">
          </div>

          <!-- Password -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input 
              type="password" 
              [(ngModel)]="password" 
              name="password" 
              required
              class="w-full px-5 py-3.5 text-lg border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-0 transition-all bg-gray-50"
              placeholder="admin123">
          </div>

          <!-- Error -->
          <div *ngIf="errorMessage" class="text-red-600 text-sm bg-red-50 p-3 rounded-2xl border border-red-200">
            {{ errorMessage }}
          </div>

          <!-- Login Button - Large touch target for mobile -->
          <button 
            type="submit" 
            [disabled]="isLoading || !loginForm.form.valid"
            class="w-full mt-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-4 rounded-2xl text-lg transition-all shadow-lg flex items-center justify-center">
            <span *ngIf="!isLoading">Sign In</span>
            <span *ngIf="isLoading" class="flex items-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Signing in...
            </span>
          </button>
        </form>

        <div class="mt-8 text-center text-xs text-gray-500 bg-gray-100 py-2 rounded-xl">
          Demo credentials<br>
          <span class="font-mono text-blue-600">admin / admin123</span>
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
