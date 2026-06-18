import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private ACCESS_TOKEN_KEY = 'access_token';
  private REFRESH_TOKEN_KEY = 'refresh_token';

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { username, password }).pipe(
      tap((response: any) => {
        if (response.accessToken) {
          localStorage.setItem(this.ACCESS_TOKEN_KEY, response.accessToken);
          if (response.refreshToken) {
            localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
          }

          // Fetch roles from /me right after login for accurate role info
          this.http.get<any>(`${this.apiUrl}/me`).subscribe({
            next: (me) => {
              localStorage.setItem('currentUser', JSON.stringify({
                username: response.username,
                roles: me.roles || []
              }));
            }
          });
        }
      })
    );
  }

  refreshToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    return this.http.post(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap((response: any) => {
        if (response.accessToken) {
          localStorage.setItem(this.ACCESS_TOKEN_KEY, response.accessToken);
        }
      })
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}).pipe(
      tap(() => {
        this.clearAuthData();
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  getCurrentUser(): any {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  getRoles(): string[] {
    const user = this.getCurrentUser();
    return user?.roles || [];
  }

  hasRole(role: string): boolean {
    return this.getRoles().includes(role);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    return !this.isTokenExpired(token);
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return true;
      const expiry = payload.exp * 1000;
      return Date.now() > expiry;
    } catch (e) {
      return true;
    }
  }

  isTokenExpiringSoon(token: string, minutes: number = 5): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return true;
      const expiry = payload.exp * 1000;
      const threshold = Date.now() + (minutes * 60 * 1000);
      return expiry < threshold;
    } catch (e) {
      return true;
    }
  }

  getTokenExpiration(): Date | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  /**
   * Call this on app startup or before protected actions.
   * Returns true if we have a valid session (or successfully refreshed).
   */
  async ensureValidSession(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    if (!this.isTokenExpired(token)) {
      return true;
    }

    // Token expired → try to refresh
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearAuthData();
      return false;
    }

    try {
      await this.refreshToken().toPromise();
      return true;
    } catch (err) {
      this.clearAuthData();
      return false;
    }
  }

  clearAuthData(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem('currentUser');
  }
}
