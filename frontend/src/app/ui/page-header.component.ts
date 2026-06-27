import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100">{{ title }}</h1>
          <p *ngIf="subtitle" class="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">{{ subtitle }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <ng-content select="[actions]"></ng-content>
        </div>
      </div>
      <div class="mt-4">
        <ng-content select="[toolbar]"></ng-content>
      </div>
    </div>
  `
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
