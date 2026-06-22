import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-4">
      <div class="font-semibold">Analysis Tools</div>
      <div class="text-xs text-zinc-400">Future Gann, RSI storm, multi-timeframe correlation, backtesting ideas</div>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <div class="font-medium mb-2">Gann Analysis</div>
        <p class="text-sm text-zinc-400">Placeholder for angle, square, and time studies on XAUUSD data. Coming soon.</p>
        <div class="mt-4 text-xs px-3 py-1 bg-zinc-800 rounded inline-block">Beta</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <div class="font-medium mb-2">RSI Storm Detection</div>
        <p class="text-sm text-zinc-400">HTF correlation and momentum storm scanner based on M15/H1 data.</p>
        <div class="mt-4 text-xs px-3 py-1 bg-zinc-800 rounded inline-block">Planned</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:col-span-2">
        <div class="font-medium mb-2">Backtest & Strategy Lab</div>
        <p class="text-sm text-zinc-400">Upload or use DB candles for simple strategy backtesting and Gann-based entries.</p>
        <button class="mt-3 text-xs px-4 py-1.5 border border-zinc-600 rounded-2xl hover:bg-zinc-800">Open Lab (coming)</button>
      </div>
    </div>
  `
})
export class AnalysisComponent {}
