import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GannIntradayStreamService } from '../services/gann-intraday-stream.service';

@Component({
  selector: 'app-gann-alert-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div
      *ngIf="alert$ | async as alert"
      class="border-b px-4 py-2.5 flex items-start gap-3 text-sm"
      [ngClass]="alert.severity === 'high'
        ? 'bg-red-950/80 border-red-900/50 text-red-100'
        : 'bg-amber-950/80 border-amber-900/50 text-amber-100'"
      role="alert">
      <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div class="flex-1 min-w-0">
        <div class="font-medium">Gann reversal {{ alert.severity }}</div>
        <div class="text-xs opacity-90 mt-0.5">{{ alert.setup }}</div>
        <a routerLink="/dashboard/gann-intraday" class="inline-block mt-1.5 text-xs font-semibold underline underline-offset-2">Open Gann Intraday</a>
      </div>
      <button type="button" (click)="dismiss()" class="shrink-0 min-h-9 min-w-9 rounded-xl active:bg-black/20 text-xs font-medium" aria-label="Dismiss alert">✕</button>
    </div>
  `
})
export class GannAlertBannerComponent {
  alert$ = this.gannStream.alert$;

  constructor(private gannStream: GannIntradayStreamService) {}

  dismiss(): void {
    this.gannStream.dismissAlert();
  }
}
