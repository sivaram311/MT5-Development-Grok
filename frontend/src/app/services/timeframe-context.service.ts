import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TimeframeContextService {
  readonly timeframes = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
  private readonly tf$ = new BehaviorSubject<string>('D1');

  readonly timeframe$ = this.tf$.asObservable();

  get current(): string {
    return this.tf$.value;
  }

  setTimeframe(tf: string): void {
    if (this.timeframes.includes(tf)) {
      this.tf$.next(tf);
    }
  }
}
