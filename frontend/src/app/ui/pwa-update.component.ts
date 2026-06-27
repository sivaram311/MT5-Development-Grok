import { Component, OnDestroy, OnInit, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-pwa-update',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="updateAvailable"
      class="fixed bottom-20 tablet:bottom-4 left-4 right-4 tablet:left-auto tablet:right-4 tablet:max-w-sm z-[70] bg-zinc-900 border border-emerald-800 rounded-2xl p-4 shadow-2xl"
      role="status">
      <div class="text-sm font-medium text-zinc-100">Update available</div>
      <div class="text-xs text-zinc-400 mt-1">A new version of Grok Dev is ready.</div>
      <button
        type="button"
        (click)="applyUpdate()"
        class="mt-3 min-h-11 w-full text-sm font-semibold rounded-xl bg-emerald-600 text-white active:bg-emerald-700">
        Reload app
      </button>
    </div>
  `
})
export class PwaUpdateComponent implements OnInit, OnDestroy {
  updateAvailable = false;
  private sub?: Subscription;

  constructor(@Optional() private swUpdate: SwUpdate | null) {}

  ngOnInit() {
    if (!this.swUpdate?.isEnabled) {
      return;
    }
    this.sub = this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.updateAvailable = true;
      });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  applyUpdate() {
    if (this.swUpdate?.isEnabled) {
      this.swUpdate.activateUpdate().then(() => document.location.reload());
    } else {
      document.location.reload();
    }
  }
}
