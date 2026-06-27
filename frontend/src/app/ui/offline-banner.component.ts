import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NetworkStatusService } from '../services/network-status.service';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div
      *ngIf="(network.bannerMessage$ | async) as msg"
      [hidden]="!msg"
      class="px-4 py-2 text-xs text-center border-b"
      role="alert"
      [class.bg-amber-950]="(network.errorKind$ | async) !== 'unauthorized'"
      [class.border-amber-800]="(network.errorKind$ | async) !== 'unauthorized'"
      [class.text-amber-200]="(network.errorKind$ | async) !== 'unauthorized'"
      [class.bg-red-950]="(network.errorKind$ | async) === 'unauthorized'"
      [class.border-red-800]="(network.errorKind$ | async) === 'unauthorized'"
      [class.text-red-200]="(network.errorKind$ | async) === 'unauthorized'">
      <span>{{ msg }}</span>
      <a
        *ngIf="(network.errorKind$ | async) === 'unauthorized'"
        routerLink="/login"
        [queryParams]="{ reason: 'session_expired' }"
        class="ml-2 underline font-semibold">
        Sign in
      </a>
    </div>
  `
})
export class OfflineBannerComponent {
  constructor(readonly network: NetworkStatusService) {}
}
