import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { GannIntradayStreamService } from './gann-intraday-stream.service';
import { HealthStreamService } from './health-stream.service';
import { OrderRsiStreamService } from './order-rsi-stream.service';

/**
 * Central lifecycle for dashboard SSE streams.
 * - Health + Gann: always on while dashboard shell is mounted (banners).
 * - Order RSI: only while Analyzer route is active.
 */
@Injectable({ providedIn: 'root' })
export class SseManagerService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly healthStream = inject(HealthStreamService);
  private readonly orderRsiStream = inject(OrderRsiStreamService);
  private readonly gannStream = inject(GannIntradayStreamService);

  private dashboardActive = false;

  startDashboard(): void {
    if (this.dashboardActive) {
      return;
    }
    this.dashboardActive = true;
    this.healthStream.start();
    this.gannStream.start();
    this.syncOrderRsiForUrl(this.router.url);

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(e => this.syncOrderRsiForUrl(e.urlAfterRedirects));
  }

  stopDashboard(): void {
    if (!this.dashboardActive) {
      return;
    }
    this.dashboardActive = false;
    this.healthStream.stop();
    this.gannStream.stop();
    this.orderRsiStream.stop();
  }

  private syncOrderRsiForUrl(url: string): void {
    if (this.isOrderRsiRoute(url)) {
      this.orderRsiStream.start();
    } else {
      this.orderRsiStream.stop();
    }
  }

  private isOrderRsiRoute(url: string): boolean {
    return /\/(dashboard|welcome)\/order-rsi(?:[?#]|$)/.test(url);
  }
}
