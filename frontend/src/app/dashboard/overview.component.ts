import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3 px-1">
        <div class="font-semibold">Recent Candles</div>
        <div class="text-xs text-zinc-500">Last 12 • D1</div>
      </div>
      
      <div class="hidden md:block bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-800 text-xs text-zinc-400">
              <th class="text-left py-3 px-5 font-medium">Time</th>
              <th class="text-right py-3 px-4 font-medium">Open</th>
              <th class="text-right py-3 px-4 font-medium">High</th>
              <th class="text-right py-3 px-4 font-medium">Low</th>
              <th class="text-right py-3 px-4 font-medium">Close</th>
              <th class="text-right py-3 px-5 font-medium">Vol (k)</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let i of [1,2,3,4,5,6,7,8,9,10,11,12]" class="border-b border-zinc-800 last:border-none hover:bg-zinc-800/50 transition-colors">
              <td class="px-5 py-3 font-mono text-xs text-zinc-400">Jun {{i}} 14:00</td>
              <td class="px-4 py-3 text-right font-mono">2650.{{i}}</td>
              <td class="px-4 py-3 text-right font-mono text-emerald-400">2670.{{i}}</td>
              <td class="px-4 py-3 text-right font-mono text-red-400">2640.{{i}}</td>
              <td class="px-4 py-3 text-right font-mono font-medium">2655.{{i}}</td>
              <td class="px-5 py-3 text-right font-mono text-xs text-zinc-400">12k</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="md:hidden space-y-2">
        <div *ngFor="let i of [1,2,3,4,5,6]" class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
          <div class="flex justify-between items-baseline">
            <div class="font-mono text-xs text-zinc-400">Jun {{i}} 14:00</div>
            <div class="font-semibold text-lg tabular-nums">2655.{{i}}</div>
          </div>
          <div class="grid grid-cols-5 gap-2 mt-3 text-center text-xs">
            <div><div class="text-zinc-500 text-[10px]">O</div>2650</div>
            <div><div class="text-emerald-500 text-[10px]">H</div>2670</div>
            <div><div class="text-red-500 text-[10px]">L</div>2640</div>
            <div><div class="text-zinc-500 text-[10px]">C</div>2655</div>
            <div><div class="text-zinc-500 text-[10px]">VOL</div>12k</div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class OverviewComponent {}
