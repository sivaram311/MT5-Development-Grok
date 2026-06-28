import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatBrokerTime, formatWallTime } from '../utils/time.util';

@Component({
  selector: 'app-candle-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 active:bg-zinc-800/50 transition-colors">
      <div class="flex justify-between items-start gap-3">
        <div class="min-w-0">
          <div class="font-mono text-xs text-zinc-400 truncate">{{ primaryTime }}</div>
          <div *ngIf="showZones" class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-zinc-500 font-mono">
            <span *ngIf="row.nyTime">NY {{ formatWallTime(row.nyTime) }}</span>
            <span *ngIf="row.istTime">IST {{ formatWallTime(row.istTime) }}</span>
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-semibold text-lg tabular-nums text-zinc-100">{{ row.close | number:'1.2-2' }}</div>
          <div *ngIf="row.rsi != null" class="text-[10px] mt-0.5">
            <span class="px-1.5 py-px rounded bg-emerald-900 text-emerald-400 font-mono">RSI {{ row.rsi | number:'1.1-1' }}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-5 gap-2 mt-3 text-center text-xs">
        <div>
          <div class="text-zinc-500 text-[10px] uppercase">O</div>
          <div class="font-mono tabular-nums">{{ row.open | number:'1.2-2' }}</div>
        </div>
        <div>
          <div class="text-emerald-500 text-[10px] uppercase">H</div>
          <div class="font-mono tabular-nums text-emerald-400">{{ row.high | number:'1.2-2' }}</div>
        </div>
        <div>
          <div class="text-red-500 text-[10px] uppercase">L</div>
          <div class="font-mono tabular-nums text-red-400">{{ row.low | number:'1.2-2' }}</div>
        </div>
        <div>
          <div class="text-zinc-500 text-[10px] uppercase">C</div>
          <div class="font-mono tabular-nums font-medium">{{ row.close | number:'1.2-2' }}</div>
        </div>
        <div>
          <div class="text-zinc-500 text-[10px] uppercase">Vol</div>
          <div class="font-mono tabular-nums text-zinc-400">{{ volumeLabel }}</div>
        </div>
      </div>
    </div>
  `
})
export class CandleCardComponent {
  @Input() row: any;
  @Input() showZones = true;

  formatWallTime = formatWallTime;

  get primaryTime(): string {
    return formatBrokerTime(this.row?.time);
  }

  get volumeLabel(): string {
    const vol = this.row?.tickVolume;
    if (vol == null) return '—';
    return `${Math.round(vol / 1000)}k`;
  }
}
