import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ApiErrorKind = 'none' | 'offline' | 'unreachable' | 'unauthorized';

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly onlineSubject = new BehaviorSubject<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  private readonly apiReachableSubject = new BehaviorSubject<boolean>(true);
  private readonly errorKindSubject = new BehaviorSubject<ApiErrorKind>('none');
  private readonly messageSubject = new BehaviorSubject<string>('');

  readonly isOnline$ = this.onlineSubject.asObservable();
  readonly apiReachable$ = this.apiReachableSubject.asObservable();
  readonly errorKind$ = this.errorKindSubject.asObservable();
  readonly bannerMessage$ = this.messageSubject.asObservable();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.onlineSubject.next(true);
        if (this.errorKindSubject.value === 'offline') {
          this.clearError();
        }
      });
      window.addEventListener('offline', () => {
        this.onlineSubject.next(false);
        this.setError('offline', 'You are offline. Live market data requires a network connection.');
      });
    }
  }

  get isOnline(): boolean {
    return this.onlineSubject.value;
  }

  setApiSuccess(): void {
    this.apiReachableSubject.next(true);
    if (this.errorKindSubject.value !== 'offline') {
      this.clearError();
    }
  }

  setApiError(status: number, fallback = 'Unable to reach the API server.'): void {
    if (status === 401) {
      this.setError('unauthorized', 'Session expired. Please sign in again.');
      return;
    }
    if (!this.isOnline) {
      this.setError('offline', 'You are offline. Showing cached data when available.');
      return;
    }
    if (status === 0) {
      this.setError('unreachable', 'Cannot connect to backend. Is Spring Boot running on port 8081?');
      return;
    }
    this.setError('unreachable', fallback);
  }

  private setError(kind: ApiErrorKind, message: string): void {
    this.errorKindSubject.next(kind);
    this.messageSubject.next(message);
    this.apiReachableSubject.next(false);
  }

  clearError(): void {
    this.errorKindSubject.next('none');
    this.messageSubject.next('');
    this.apiReachableSubject.next(true);
  }
}
