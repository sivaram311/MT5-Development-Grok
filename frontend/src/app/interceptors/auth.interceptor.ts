import { Injectable, Injector } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError, BehaviorSubject, switchMap, filter, take, catchError, tap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NetworkStatusService } from '../services/network-status.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  constructor(
    private authService: AuthService,
    private network: NetworkStatusService,
    private injector: Injector
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();
    let request = req;

    if (token) {
      if (this.authService.isTokenExpiringSoon(token, 5)) {
        return this.handleProactiveRefresh(request, next);
      }
      request = this.addTokenHeader(request, token);
    }

    return next.handle(request).pipe(
      tap(() => {
        if (request.url.includes('/api/')) {
          this.network.setApiSuccess();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        if (request.url.includes('/api/') && !request.url.includes('/auth/login')) {
          this.network.setApiError(error.status || 0);
        }
        if (error.status === 401 && !request.url.includes('/auth/')) {
          return this.handle401Error(request, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handleProactiveRefresh(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap((response: { accessToken?: string }) => {
          this.isRefreshing = false;
          const newToken = response.accessToken || '';
          this.refreshTokenSubject.next(newToken);
          return next.handle(this.addTokenHeader(req, newToken));
        }),
        catchError(err => this.failAuth(err))
      );
    }

    return this.refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap(token => next.handle(this.addTokenHeader(req, token)))
    );
  }

  private handle401Error(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap((response: { accessToken?: string }) => {
          this.isRefreshing = false;
          if (response.accessToken) {
            this.refreshTokenSubject.next(response.accessToken);
            return next.handle(this.addTokenHeader(request, response.accessToken));
          }
          return throwError(() => new Error('Unable to refresh token'));
        }),
        catchError(err => this.failAuth(err))
      );
    }

    return this.refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap(token => next.handle(this.addTokenHeader(request, token)))
    );
  }

  private failAuth(err: unknown): Observable<never> {
    this.isRefreshing = false;
    this.authService.clearAuthData();
    this.network.setApiError(401);
    this.injector.get(Router).navigate(['/login'], { queryParams: { reason: 'session_expired' } });
    return throwError(() => err);
  }

  private addTokenHeader(request: HttpRequest<unknown>, token: string) {
    return request.clone({
      headers: request.headers.set('Authorization', `Bearer ${token}`)
    });
  }
}
