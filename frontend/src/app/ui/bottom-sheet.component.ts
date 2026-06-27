import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="open"
      class="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center sm:items-end sm:p-4"
      (click)="close.emit()"
      role="dialog"
      aria-modal="true">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      <div
        class="relative w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col sheet-enter"
        (click)="$event.stopPropagation()">
        <div class="flex justify-center pt-3 pb-1 sm:hidden">
          <div class="w-10 h-1 rounded-full bg-zinc-700"></div>
        </div>

        <div class="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h2 class="font-semibold text-base text-zinc-100">{{ title }}</h2>
          <button
            type="button"
            (click)="close.emit()"
            class="min-h-11 min-w-11 flex items-center justify-center rounded-2xl text-zinc-400 active:bg-zinc-800"
            aria-label="Close">
            ✕
          </button>
        </div>

        <div class="px-5 py-4 overflow-y-auto flex-1">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `
})
export class BottomSheetComponent {
  @Input() open = false;
  @Input() title = '';
  @Output() close = new EventEmitter<void>();
}
