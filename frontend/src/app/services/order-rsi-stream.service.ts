import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface OrderRsiTimeBlock {
  broker: string;
  ny: string;
  ist: string;
}

export interface OrderRsiTfRow {
  timeframe: string;
  barIndex: number;
  forming: boolean;
  time: OrderRsiTimeBlock;
  close: number;
  rsi: number | null;
  rsiPeriod: number;
}

export interface OrderRsiSnapshot {
  symbol: string;
  live: boolean;
  message?: string;
  price: number | null;
  priceSource?: string;
  pushMode?: string;
  asOf: OrderRsiTimeBlock;
  timeframes: Record<string, OrderRsiTfRow>;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderRsiStreamService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private snapshotSubject = new BehaviorSubject<OrderRsiSnapshot | null>(null);
  snapshot$ = this.snapshotSubject.asObservable();
  private connectedSubject = new BehaviorSubject(false);
  connected$ = this.connectedSubject.asObservable();

  constructor(private auth: AuthService) {}

  start(): void {
    const token = this.auth.getToken();
    if (!token || this.auth.isTokenExpired(token)) {
      return;
    }
    this.stop();

    const url = `${environment.apiUrl}/market/xauusd/order-rsi/stream?access_token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('orderRsi', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as OrderRsiSnapshot;
        this.snapshotSubject.next(data);
        this.connectedSubject.next(true);
      } catch {
        // ignore malformed
      }
    });

    this.eventSource.onerror = () => {
      this.connectedSubject.next(false);
      this.stop();
    };
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
