import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { GannIntradayStudy } from '../utils/gann-intraday.util';
import { ReversalSeverity } from '../utils/gann-killzone.util';

export interface GannIntradaySnapshot extends GannIntradayStudy {
  live?: boolean;
  message?: string;
  symbol?: string;
  streamConnected?: boolean;
  updatedAt?: string;
  source?: string;
}

export interface GannAlertState {
  severity: ReversalSeverity;
  setup: string;
  reasons: string[];
}

@Injectable({ providedIn: 'root' })
export class GannIntradayStreamService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private snapshotSubject = new BehaviorSubject<GannIntradaySnapshot | null>(null);
  snapshot$ = this.snapshotSubject.asObservable();
  private connectedSubject = new BehaviorSubject(false);
  connected$ = this.connectedSubject.asObservable();
  private alertSubject = new BehaviorSubject<GannAlertState | null>(null);
  alert$ = this.alertSubject.asObservable();
  private dismissed = false;

  constructor(private auth: AuthService) {}

  start(): void {
    const token = this.auth.getToken();
    if (!token || this.auth.isTokenExpired(token)) {
      return;
    }
    this.stop();

    const url = `${environment.apiUrl}/market/xauusd/gann-intraday/stream?access_token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('gannIntraday', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as GannIntradaySnapshot;
        this.snapshotSubject.next(data);
        this.connectedSubject.next(true);
        this.updateAlert(data);
      } catch {
        // ignore malformed
      }
    });

    this.eventSource.onerror = () => {
      this.connectedSubject.next(false);
      this.stop();
    };
  }

  private updateAlert(data: GannIntradaySnapshot): void {
    if (this.dismissed) return;
    const alert = data.reversalAlert;
    if (alert && (alert.severity === 'high' || alert.severity === 'medium')) {
      this.alertSubject.next({
        severity: alert.severity,
        setup: alert.setup,
        reasons: alert.reasons
      });
    } else {
      this.alertSubject.next(null);
    }
  }

  pushAlertFromStudy(study: GannIntradayStudy | null): void {
    if (this.dismissed || !study?.reversalAlert) {
      return;
    }
    const alert = study.reversalAlert;
    if (alert.severity === 'high' || alert.severity === 'medium') {
      this.alertSubject.next({
        severity: alert.severity,
        setup: alert.setup,
        reasons: alert.reasons
      });
    }
  }

  dismissAlert(): void {
    this.dismissed = true;
    this.alertSubject.next(null);
  }

  resetDismiss(): void {
    this.dismissed = false;
  }

  stop(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.connectedSubject.next(false);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
