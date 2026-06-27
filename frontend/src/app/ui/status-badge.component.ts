import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide"
      [ngClass]="toneClasses">
      {{ label }}
    </span>
  `
})
export class StatusBadgeComponent {
  @Input() label = '';
  @Input() tone: StatusTone = 'neutral';

  get toneClasses(): string {
    switch (this.tone) {
      case 'success':
        return 'bg-emerald-900/80 text-emerald-400 border border-emerald-800';
      case 'warning':
        return 'bg-amber-900/80 text-amber-400 border border-amber-800';
      case 'danger':
        return 'bg-red-900/80 text-red-400 border border-red-800';
      default:
        return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
    }
  }
}
