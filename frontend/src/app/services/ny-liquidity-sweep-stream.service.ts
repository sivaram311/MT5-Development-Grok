import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { GANN_INTRADAY_UI_THROTTLE_MS } from './stream-throttle.config';

export interface LiquiditySetup {
  setup_id: string;
  date: string;
  ny_time: string;
  ist_time: string;
  direction: string;
  sweep_level: number;
  structure_level: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  result: string;
  rr_achieved?: number;
  rsi_htf?: number;
  rsi_ltf?: number;
  notes?: string;
  how_spotted?: string;
  live?: boolean;
  message?: string;
  payload?: Record<string, unknown>;
}

export interface LiquidityAlertState {
  severity: 'high' | 'medium';
  setup: string;
  direction: string;
}

@Injectable({ providedIn: 'root' })
export class NyLiquiditySweepStreamService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private rawSnapshot$ = new Subject<LiquiditySetup | null>();
  private snapshotSubject = new BehaviorSubject<LiquiditySetup | null>(null);
  snapshot$ = this.snapshotSubject.asObservable();
  private connectedSubject = new BehaviorSubject(false);
  connected$ = this.connectedSubject.asObservable();
  private alertSubject = new BehaviorSubject<LiquidityAlertState | null>(null);
  alert$ = this.alertSubject.asObservable();
  private dismissed = false;

  constructor(private auth: AuthService) {
    this.rawSnapshot$.pipe(
      throttleTime(GANN_INTRADAY_UI_THROTTLE_MS, undefined, { leading: true, trailing: true })
    ).subscribe(data => this.snapshotSubject.next(data));
  }

  start(): void {
    const token = this.auth.getToken();
    if (!token || this.auth.isTokenExpired(token)) {
      return;
    }
    this.stop();
    const url = `${environment.apiUrl}/market/xauusd/ny-liquidity-sweep/stream?access_token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);
    this.eventSource.addEventListener('nyLiquiditySweep', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as LiquiditySetup;
        this.rawSnapshot$.next(data);
        this.connectedSubject.next(true);
        this.updateAlert(data);
      } catch {
        // ignore
      }
    });
    this.eventSource.onerror = () => {
      this.connectedSubject.next(false);
      this.stop();
    };
  }

  private updateAlert(data: LiquiditySetup): void {
    if (this.dismissed || !data?.live) {
      return;
    }
    if (data.direction && data.how_spotted) {
      this.alertSubject.next({
        severity: 'high',
        setup: data.how_spotted,
        direction: data.direction
      });
    } else {
      this.alertSubject.next(null);
    }
  }

  dismissAlert(): void {
    this.dismissed = true;
    this.alertSubject.next(null);
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
