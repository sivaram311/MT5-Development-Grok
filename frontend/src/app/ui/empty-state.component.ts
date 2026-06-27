import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-5 py-10 text-center">
      <div *ngIf="loading" class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-zinc-400">{{ loadingMessage }}</p>
      </div>
      <div *ngIf="!loading">
        <p class="text-sm text-zinc-400 leading-relaxed">{{ message }}</p>
        <button
          *ngIf="actionLabel"
          type="button"
          (click)="actionClick.emit()"
          class="mt-4 min-h-11 px-5 text-sm font-semibold rounded-2xl border border-emerald-800 text-emerald-400 active:bg-emerald-950">
          {{ actionLabel }}
        </button>
      </div>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() message = 'No data available.';
  @Input() loading = false;
  @Input() loadingMessage = 'Loading…';
  @Input() actionLabel = '';
  @Output() actionClick = new EventEmitter<void>();
}
