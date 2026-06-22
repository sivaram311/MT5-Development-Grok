import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-health',
  standalone: true,
  imports: [CommonModule],
  template: \
    <div class="mb-4">
      <div class="font-semibold mb-1">Pipeline Health</div>
      <div class="text-xs text-zinc-400">Per-timeframe freshness based on completed candles</div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
      <div *ngFor="let tf of ['D1','H4','H1','M15','M5','M1']" class="bg-zinc-900 border border-zinc-800 rounded-3xl px-4 py-4 text-sm border-emerald-700">
        <div class="flex justify-between">
          <div class="font-semibold">{{ tf }}</div>
          <div class="text-xs text-emerald-400">FRESH</div>
        </div>
        <div class="font-mono text-lg mt-2 text-zinc-100">14:30</div>
      </div>
    </div>
  \
})
export class HealthComponent {}
