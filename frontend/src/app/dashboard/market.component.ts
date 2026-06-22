import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mb-4 flex items-center justify-between">
      <div class="font-semibold">Data Explorer</div>
      <div class="flex items-center gap-2">
        <select [(ngModel)]="selectedTimeframe" (change)="loadData()" class="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs">
          <option *ngFor="let tf of timeframes" [value]="tf">{{ tf }}</option>
        </select>
        <label class="flex items-center gap-1 text-xs ml-2 cursor-pointer">
          <input type="checkbox" [ngModel]="nySessionOnly" (ngModelChange)="onNySessionOnlyChange($event)">
          NY Session Only
        </label>
        <button (click)="columnDrawerOpen = !columnDrawerOpen" class="text-xs px-3 py-1.5 rounded-2xl border border-zinc-700 hover:bg-zinc-900">
          Customize columns
        </button>
        <button (click)="loadData()" class="text-xs px-3 py-1.5 rounded-2xl border border-emerald-700 hover:bg-emerald-900">
          Refresh
        </button>
      </div>
    </div>

    <!-- Column Drawer -->
    <div *ngIf="columnDrawerOpen" class="fixed inset-0 z-50 flex" (click)="columnDrawerOpen = false">
      <div class="flex-1"></div>
      <div class="w-80 bg-zinc-900 border-l border-zinc-700 p-4 overflow-auto" (click)="$event.stopPropagation()">
        <div class="flex justify-between mb-4">
          <div class="font-semibold">Visible Columns</div>
          <button (click)="columnDrawerOpen = false">✕</button>
        </div>
        <div class="space-y-2">
          <div *ngFor="let col of columnDefs" class="flex justify-between items-center">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" [(ngModel)]="col.visible">
              {{ col.label }}
            </label>
          </div>
        </div>
        <div class="mt-4 text-xs text-zinc-400">Changes apply to the table below (refresh if needed).</div>
      </div>
    </div>

    <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
      <div class="px-5 py-3 border-b border-zinc-800 text-xs text-zinc-400 flex items-center">
        <span>DATA GRID — {{ selectedTimeframe }} ({{ gridData.length }} rows)</span>
        <span class="ml-auto">NEWEST FIRST</span>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-800 text-[10px] text-zinc-400 bg-zinc-950">
              <th *ngFor="let col of getVisibleColumns()" class="py-3 px-3 font-medium text-left">{{ col.label }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800">
            <tr *ngFor="let row of gridData" class="hover:bg-zinc-800/40">
              <td *ngFor="let col of getVisibleColumns()" class="px-3 py-2.5 font-mono text-xs">
                <ng-container [ngSwitch]="col.key">
                  <span *ngSwitchCase="'time'">{{ row.time | date:'MMM dd HH:mm' }}</span>
                  <span *ngSwitchCase="'nyTime'">{{ formatWallTime(row.nyTime) }}</span>
                  <span *ngSwitchCase="'istTime'">{{ formatWallTime(row.istTime) }}</span>
                  <span *ngSwitchCase="'open'">{{ row.open | number:'1.2-2' }}</span>
                  <span *ngSwitchCase="'high'">{{ row.high | number:'1.2-2' }}</span>
                  <span *ngSwitchCase="'low'">{{ row.low | number:'1.2-2' }}</span>
                  <span *ngSwitchCase="'close'">{{ row.close | number:'1.2-2' }}</span>
                  <span *ngSwitchCase="'rsi'">
                    <span *ngIf="row.rsi != null" class="px-1.5 py-px rounded text-xs bg-emerald-900 text-emerald-400">{{ row.rsi | number:'1.1-1' }}</span>
                    <span *ngIf="row.rsi == null" class="text-zinc-600">—</span>
                  </span>
                  <span *ngSwitchCase="'tickVolume'">{{ (row.tickVolume / 1000) | number:'1.0-0' }}k</span>
                </ng-container>
              </td>
            </tr>
            <tr *ngIf="gridData.length === 0">
              <td [attr.colspan]="getVisibleColumns().length || 8" class="px-5 py-8 text-center text-sm text-zinc-400">No data loaded. Make sure the Python downloader has run and backend is serving data.</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex justify-between text-xs">
        <div>{{ gridData.length }} rows (showing up to 500)</div>
        <button (click)="loadData()" class="text-emerald-400 hover:text-emerald-300">Refresh Grid</button>
      </div>
    </div>
  `
})
export class MarketComponent implements OnInit {
  columnDrawerOpen = false;
  gridData: any[] = [];
  selectedTimeframe = 'D1';
  timeframes = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
  nySessionOnly = false;
  
  // Simple column visibility for demo
  columnDefs = [
    { key: 'time', label: 'BROKER', visible: true },
    { key: 'nyTime', label: 'NY', visible: true },
    { key: 'istTime', label: 'IST', visible: true },
    { key: 'open', label: 'OPEN', visible: true },
    { key: 'high', label: 'HIGH', visible: true },
    { key: 'low', label: 'LOW', visible: true },
    { key: 'close', label: 'CLOSE', visible: true },
    { key: 'rsi', label: 'RSI', visible: true },
    { key: 'tickVolume', label: 'VOL', visible: false }
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    const limit = 500;
    let url = `${environment.apiUrl}/market/xauusd/${this.selectedTimeframe}/grid?limit=${limit}&ny_session_only=${this.nySessionOnly}`;
    this.http.get<any[]>(url)
      .subscribe({
        next: (data) => {
          this.gridData = data || [];
          console.log('Loaded grid data:', this.gridData.length, 'rows for', this.selectedTimeframe, 'nyOnly=', this.nySessionOnly);
        },
        error: (err) => {
          console.error('Failed to load grid data', err);
          this.gridData = [];
        }
      });
  }

  getVisibleColumns() {
    return this.columnDefs.filter(c => c.visible);
  }

  // Format a backend wall-time string (e.g. "2026-06-18T17:30:00") as display time
  // without going through JS Date (which interprets no-offset ISO as browser local TZ
  // and can shift the displayed IST/NY digits depending on viewer's timezone).
  // Keeps the exact wall-clock numbers the backend computed for that zone.
  formatWallTime(dt: string | null | undefined): string {
    if (!dt) return '—';
    // Expect ISO local like 2026-06-18T17:30:00 or with millis; take date + HH:mm
    const s = dt.toString();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    if (m) {
      // Convert to short like previous pipe: "Jun 18 17:30" (approx; full date pipe used MMM dd HH:mm)
      const d = new Date(m[1] + 'T00:00:00Z'); // only for month name, UTC safe
      const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const day = m[1].slice(8, 10);
      return `${mon} ${day} ${m[2]}`;
    }
    // Fallback: return time portion if possible
    const t = s.split('T')[1] || s.split(' ')[1] || s;
    return t.substring(0, 5);
  }

  onNySessionOnlyChange(value: boolean) {
    this.nySessionOnly = value;
    this.loadData();
  }
}
