import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NyLiquiditySweepStreamService } from '../services/ny-liquidity-sweep-stream.service';

@Component({
  selector: 'app-liquidity-alert-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  template: `
    <div
      *ngIf="alert$ | async as alert"
      class="border-b px-4 py-2.5 flex items-start gap-3 text-sm bg-emerald-950/80 border-emerald-900/50 text-emerald-100"
      role="alert">
      <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
      <div class="flex-1 min-w-0">
        <div class="font-medium">NY Liquidity {{ alert.direction }} setup</div>
        <div class="text-xs opacity-90 mt-0.5">{{ alert.setup }}</div>
        <a routerLink="/dashboard/ny-liquidity-sweep" class="inline-block mt-1.5 text-xs font-semibold underline underline-offset-2">Open analyzer</a>
      </div>
      <button type="button" (click)="dismiss()" class="shrink-0 min-h-9 min-w-9 rounded-xl active:bg-black/20 text-xs font-medium" aria-label="Dismiss">✕</button>
    </div>
  `
})
export class LiquidityAlertBannerComponent {
  alert$ = this.stream.alert$;
  constructor(private stream: NyLiquiditySweepStreamService) {}
  dismiss(): void {
    this.stream.dismissAlert();
  }
}
