import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { hapticTap } from '../utils/haptic.util';

export interface HealthAlert {
  status: 'DEGRADED' | 'DOWN' | 'UP';
  message: string;
  freshCount?: number;
  total?: number;
  checkedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class HealthStreamService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private lastStatus: string | null = null;

  private alertSubject = new BehaviorSubject<HealthAlert | null>(null);
  alert$ = this.alertSubject.asObservable();

  private statusSubject = new BehaviorSubject<string | null>(null);
  status$ = this.statusSubject.asObservable();

  constructor(private auth: AuthService) {}

  start(): void {
    const token = this.auth.getToken();
    if (!token || this.auth.isTokenExpired(token)) {
      return;
    }
    this.stop();

    const url = `${environment.apiUrl}/market/xauusd/health/stream?access_token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('health', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const status = String(data.status || 'UNKNOWN');
        this.statusSubject.next(status);

        if (this.lastStatus && status !== this.lastStatus && (status === 'DEGRADED' || status === 'DOWN')) {
          hapticTap();
          this.alertSubject.next({
            status: status as HealthAlert['status'],
            message: status === 'DOWN'
              ? 'Market data pipeline is down. Check Health page.'
              : 'Market data pipeline degraded. Some timeframes may be stale.',
            freshCount: data.freshCount,
            total: data.total,
            checkedAt: data.checkedAt
          });
        }

        if (status === 'UP' && this.alertSubject.value) {
          this.dismissAlert();
        }

        this.lastStatus = status;
      } catch {
        // ignore malformed payloads
      }
    });

    this.eventSource.onerror = () => {
      this.stop();
    };
  }

  dismissAlert(): void {
    this.alertSubject.next(null);
  }

  stop(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
