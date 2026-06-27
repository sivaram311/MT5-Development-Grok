import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { hapticRefresh, hapticTap } from '../utils/haptic.util';

@Component({
  selector: 'app-pull-to-refresh',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative overflow-hidden">
      <div
        class="flex justify-center items-end overflow-hidden transition-[height] duration-150 ease-out pointer-events-none"
        [style.height.px]="indicatorHeight"
        aria-hidden="true">
        <div class="pb-2 flex items-center gap-2 text-xs text-zinc-400">
          <span
            *ngIf="refreshing"
            class="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin">
          </span>
          <span>{{ statusLabel }}</span>
        </div>
      </div>
      <div [style.transform]="contentTransform" class="transition-transform duration-150 ease-out">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class PullToRefreshComponent {
  @Input() disabled = false;
  @Output() refresh = new EventEmitter<void>();

  pullDistance = 0;
  refreshing = false;
  private startY = 0;
  private tracking = false;
  private readonly threshold = 72;
  private readonly maxPull = 120;
  private hapticArmed = false;

  get indicatorHeight(): number {
    if (this.refreshing) {
      return 48;
    }
    return Math.max(0, this.pullDistance * 0.6);
  }

  get contentTransform(): string {
    if (this.refreshing) {
      return 'translateY(48px)';
    }
    return `translateY(${Math.min(this.pullDistance, this.maxPull)}px)`;
  }

  get statusLabel(): string {
    if (this.refreshing) {
      return 'Refreshing…';
    }
    if (this.pullDistance >= this.threshold) {
      return 'Release to refresh';
    }
    if (this.pullDistance > 8) {
      return 'Pull to refresh';
    }
    return '';
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    if (this.disabled || this.refreshing) {
      return;
    }
    if (window.scrollY > 4) {
      return;
    }
    this.startY = event.touches[0].clientY;
    this.tracking = true;
    this.hapticArmed = true;
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (!this.tracking || this.disabled || this.refreshing) {
      return;
    }
    if (window.scrollY > 4) {
      this.resetPull();
      return;
    }
    const delta = event.touches[0].clientY - this.startY;
    if (delta > 0) {
      this.pullDistance = Math.min(delta * 0.5, this.maxPull);
      if (this.pullDistance >= this.threshold && this.hapticArmed) {
        hapticTap(8);
        this.hapticArmed = false;
      }
      if (this.pullDistance > 8) {
        event.preventDefault();
      }
    } else {
      this.pullDistance = 0;
    }
  }

  @HostListener('touchend')
  onTouchEnd() {
    if (!this.tracking || this.disabled) {
      return;
    }
    this.tracking = false;
    if (this.pullDistance >= this.threshold && !this.refreshing) {
      this.refreshing = true;
      this.pullDistance = 0;
      hapticRefresh();
      this.refresh.emit();
    } else {
      this.resetPull();
    }
  }

  completeRefresh() {
    this.refreshing = false;
    this.resetPull();
  }

  private resetPull() {
    this.pullDistance = 0;
    this.tracking = false;
  }
}
