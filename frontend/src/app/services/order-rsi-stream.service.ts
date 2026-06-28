import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export type OrderRsiSourceMode = 'python_wilder' | 'mt5_iRSI';

export type OrderRsiSrLevelKey = 's3' | 's2' | 's1' | 'pivot' | 'r1' | 'r2' | 'r3';

export interface OrderRsiSrLevels {
  s3: number;
  s2: number;
  s1: number;
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
}

export interface OrderRsiTimeBlock {
  broker: string;
  ny: string;
  ist: string;
  utc?: string;
}

export interface OrderRsiMt5Shift {
  rsi: number | null;
  close?: number;
}

export interface OrderRsiMt5Block {
  available: boolean;
  shift0: OrderRsiMt5Shift;
  shift1: OrderRsiMt5Shift;
}

/** MT5 shift 1 — last completed candle. */
export interface OrderRsiCompletedBar {
  barIndex: number;
  forming: boolean;
  time: OrderRsiTimeBlock;
  close: number;
  rsi: number | null;
  /** Classic floor pivots from Bar 1 H/L/C. */
  sr?: OrderRsiSrLevels;
}

export interface OrderRsiTfRow {
  timeframe: string;
  barIndex: number;
  forming: boolean;
  time: OrderRsiTimeBlock;
  close: number;
  /** Python Wilder RSI — forming bar (shift 0). */
  rsi: number | null;
  rsiPeriod: number;
  rsiSource?: string;
  historyBars?: number;
  /** Classic floor pivots from Bar 0 H/L/C. */
  sr?: OrderRsiSrLevels;
  completed?: OrderRsiCompletedBar;
  /** MT5 built-in iRSI from GrokDevOrderRsiExport EA (when available). */
  mt5?: OrderRsiMt5Block;
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
  mt5ExportAvailable?: boolean;
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
