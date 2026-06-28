import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type NavIconName =
  | 'home'
  | 'market'
  | 'order-rsi'
  | 'gann-intraday'
  | 'liquidity'
  | 'volatility'
  | 'health'
  | 'analysis'
  | 'docs'
  | 'more'
  | 'logout';

@Component({
  selector: 'app-nav-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      class="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <ng-container [ngSwitch]="name">
        <path *ngSwitchCase="'home'" d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"/>
        <g *ngSwitchCase="'market'">
          <path d="M4 19V5m0 14h16"/>
          <path d="M8 17V9m4 8V7m4 10v-4"/>
        </g>
        <g *ngSwitchCase="'order-rsi'">
          <path d="M4 19V5"/>
          <path d="M4 15h16"/>
          <path d="M8 11V7m4 4V5m4 6V9"/>
        </g>
        <g *ngSwitchCase="'gann-intraday'">
          <path d="M12 2v20"/>
          <path d="M2 12h20"/>
          <path d="m7 7 10 10M17 7 7 17"/>
        </g>
        <g *ngSwitchCase="'liquidity'">
          <path d="M4 19V5"/>
          <path d="M4 12h6l2-4 4 8 2-4h2"/>
        </g>
        <path *ngSwitchCase="'volatility'" d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
        <path *ngSwitchCase="'health'" d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z"/>
        <g *ngSwitchCase="'analysis'">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4"/>
          <path d="M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9"/>
        </g>
        <g *ngSwitchCase="'docs'">
          <path d="M12 6.5V19M6 8.5h12"/>
          <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
        </g>
        <g *ngSwitchCase="'more'">
          <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        </g>
        <g *ngSwitchCase="'logout'">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <path d="M16 17l5-5-5-5M21 12H9"/>
        </g>
      </ng-container>
    </svg>
  `
})
export class NavIconComponent {
  @Input() name: NavIconName = 'home';
}
