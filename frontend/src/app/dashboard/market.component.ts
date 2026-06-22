import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule],
  template: \
    <div class="mb-4 flex items-center justify-between">
      <div class="font-semibold">Data Explorer</div>
      <button (click)="showDrawer = !showDrawer" class="text-xs px-3 py-1.5 rounded-2xl border border-zinc-700 hover:bg-zinc-900">
        Customize columns
      </button>
    </div>

    <div *ngIf="showDrawer" class="mb-4 p-4 bg-zinc-900 border border-zinc-800 rounded-3xl">
      <div class="text-sm mb-2">Column toggles (demo)</div>
      <div class="flex flex-wrap gap-2">
        <div *ngFor="let c of ['Broker','NY','IST','O','H','L','C','RSI']" class="px-3 py-1 text-xs rounded-2xl border bg-white text-zinc-950">{{ c }}</div>
      </div>
    </div>

    <div class="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
      <div class="px-5 py-3 border-b border-zinc-800 text-xs text-zinc-400 flex items-center">
        <span>DATA GRID — D1</span>
        <span class="ml-auto">NEWEST FIRST</span>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-800 text-[10px] text-zinc-400 bg-zinc-950">
              <th class="py-3 px-3 font-medium text-left">BROKER</th>
              <th class="py-3 px-3 font-medium text-left">NY</th>
              <th class="py-3 px-3 font-medium text-left">IST</th>
              <th class="py-3 px-3 font-medium text-right">OPEN</th>
              <th class="py-3 px-3 font-medium text-right">HIGH</th>
              <th class="py-3 px-3 font-medium text-right">LOW</th>
              <th class="py-3 px-3 font-medium text-right">CLOSE</th>
              <th class="py-3 px-3 font-medium text-right">RSI</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800">
            <tr *ngFor="let i of [1,2,3]" class="hover:bg-zinc-800/40">
              <td class="px-3 py-2.5 font-mono text-xs">Jun {{i}} 14:00</td>
              <td class="px-3 py-2.5 font-mono text-xs text-blue-400">Jun {{i}} 10:00</td>
              <td class="px-3 py-2.5 font-mono text-xs text-emerald-400">Jun {{i+1}} 00:30</td>
              <td class="px-3 py-2.5 text-right font-mono">2650.{{i}}</td>
              <td class="px-3 py-2.5 text-right font-mono text-emerald-400">2670.{{i}}</td>
              <td class="px-3 py-2.5 text-right font-mono text-red-400">2640.{{i}}</td>
              <td class="px-3 py-2.5 text-right font-mono font-medium">2655.{{i}}</td>
              <td class="px-3 py-2.5 text-right font-mono">
                <span class="px-1.5 py-px rounded text-xs bg-emerald-900 text-emerald-400">62.{{i}}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex justify-between text-xs">
        <div>12 rows</div>
        <button class="text-emerald-400 hover:text-emerald-300">Refresh Grid</button>
      </div>
    </div>
  \
})
export class MarketComponent {
  showDrawer = false;
}
