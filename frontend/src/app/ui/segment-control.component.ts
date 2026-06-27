import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-segment-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x scrollbar-hide"
      role="tablist"
      [attr.aria-label]="ariaLabel">
      <button
        *ngFor="let option of options"
        type="button"
        role="tab"
        [attr.aria-selected]="option === value"
        (click)="select(option)"
        class="min-h-11 px-4 py-2 text-sm font-medium rounded-2xl border whitespace-nowrap snap-start transition-colors active:scale-[0.98]"
        [class.bg-white]="option === value"
        [class.text-zinc-950]="option === value"
        [class.border-white]="option === value"
        [class.bg-zinc-900]="option !== value"
        [class.text-zinc-300]="option !== value"
        [class.border-zinc-700]="option !== value">
        {{ option }}
      </button>
    </div>
  `
})
export class SegmentControlComponent {
  @Input() options: string[] = [];
  @Input() value = '';
  @Input() ariaLabel = 'Options';
  @Output() valueChange = new EventEmitter<string>();

  select(option: string) {
    if (option !== this.value) {
      this.value = option;
      this.valueChange.emit(option);
    }
  }
}
