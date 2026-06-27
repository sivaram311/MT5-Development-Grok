import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GridColumnPref {
  visibility: Record<string, boolean>;
  order: string[];
}

export interface VolatilityPref {
  limit?: number;
  nySessionOnly?: boolean;
  sortKey?: string;
  sortAsc?: boolean;
}

/** Maps legacy welcome.component column keys to market.component keys. */
const LEGACY_COLUMN_KEY_MAP: Record<string, string> = {
  broker: 'time',
  ny: 'nyTime',
  ist: 'istTime',
  vol: 'tickVolume'
};

const DEFAULT_COLUMN_ORDER = [
  'time', 'nyTime', 'istTime', 'open', 'high', 'low', 'close', 'rsi', 'tickVolume'
];

const DEFAULT_VISIBILITY: Record<string, boolean> = {
  time: true,
  nyTime: true,
  istTime: true,
  open: true,
  high: true,
  low: true,
  close: true,
  rsi: true,
  tickVolume: false
};

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private cache: Record<string, unknown> = {};
  private loaded = false;

  constructor(private http: HttpClient) {}

  load(): Observable<void> {
    if (this.loaded) {
      return of(undefined);
    }
    return this.http.get<{ preferences?: string }>(`${environment.apiUrl}/auth/preferences`).pipe(
      tap((res) => {
        try {
          this.cache = JSON.parse(res?.preferences || '{}');
        } catch {
          this.cache = {};
        }
        this.loaded = true;
      }),
      map(() => undefined),
      catchError(() => {
        this.cache = {};
        this.loaded = true;
        return of(undefined);
      })
    );
  }

  getGridPref(timeframe: string): GridColumnPref {
    const grid = (this.cache['grid'] as Record<string, GridColumnPref>) || {};
    const raw = grid[timeframe];
    if (!raw) {
      return {
        visibility: { ...DEFAULT_VISIBILITY },
        order: [...DEFAULT_COLUMN_ORDER]
      };
    }
    return {
      visibility: this.normalizeVisibility(raw.visibility),
      order: this.normalizeOrder(raw.order)
    };
  }

  getMarketUi(): { viewMode?: 'cards' | 'table'; nySessionOnly?: boolean } {
    return (this.cache['market'] as { viewMode?: 'cards' | 'table'; nySessionOnly?: boolean }) || {};
  }

  saveGridPref(timeframe: string, visibility: Record<string, boolean>, order: string[]): Observable<unknown> {
    if (!this.cache['grid']) {
      this.cache['grid'] = {};
    }
    const grid = this.cache['grid'] as Record<string, GridColumnPref>;
    grid[timeframe] = {
      visibility: this.normalizeVisibility(visibility),
      order: this.normalizeOrder(order)
    };
    return this.persistPatch({ grid: { [timeframe]: grid[timeframe] } });
  }

  saveMarketUi(ui: { viewMode?: 'cards' | 'table'; nySessionOnly?: boolean }): Observable<unknown> {
    const current = this.getMarketUi();
    this.cache['market'] = { ...current, ...ui };
    return this.persistPatch({ market: this.cache['market'] });
  }

  getVolatilityPref(timeframe: string): VolatilityPref {
    const volatility = (this.cache['volatility'] as Record<string, VolatilityPref>) || {};
    const raw = volatility[timeframe];
    return {
      limit: raw?.limit ?? 90,
      nySessionOnly: raw?.nySessionOnly ?? false,
      sortKey: raw?.sortKey ?? 'diff',
      sortAsc: raw?.sortAsc ?? false
    };
  }

  getVolatilityLastTimeframe(): string | undefined {
    return (this.cache['volatility'] as { lastTimeframe?: string })?.lastTimeframe;
  }

  saveVolatilityPref(timeframe: string, pref: VolatilityPref): Observable<unknown> {
    if (!this.cache['volatility']) {
      this.cache['volatility'] = {};
    }
    const volatility = this.cache['volatility'] as Record<string, VolatilityPref> & { lastTimeframe?: string };
    volatility[timeframe] = { ...volatility[timeframe], ...pref };
    volatility.lastTimeframe = timeframe;
    return this.persistPatch({
      volatility: {
        [timeframe]: volatility[timeframe],
        lastTimeframe: timeframe
      }
    });
  }

  /** PATCH partial preferences — server deep-merges to avoid overwriting other sections. */
  private persistPatch(section: Record<string, unknown>): Observable<unknown> {
    return this.http.patch<{ preferences?: string }>(`${environment.apiUrl}/auth/preferences`, {
      preferences: JSON.stringify(section)
    }).pipe(
      tap(res => {
        if (res?.preferences) {
          try {
            this.cache = JSON.parse(res.preferences);
          } catch {
            // keep local cache on parse failure
          }
        }
      })
    );
  }

  private normalizeKey(key: string): string {
    return LEGACY_COLUMN_KEY_MAP[key] || key;
  }

  private normalizeVisibility(input?: Record<string, boolean>): Record<string, boolean> {
    const result = { ...DEFAULT_VISIBILITY };
    if (!input) {
      return result;
    }
    Object.entries(input).forEach(([key, value]) => {
      const normalized = this.normalizeKey(key);
      if (normalized in DEFAULT_VISIBILITY) {
        result[normalized] = value;
      }
    });
    return result;
  }

  private normalizeOrder(input?: string[]): string[] {
    if (!input?.length) {
      return [...DEFAULT_COLUMN_ORDER];
    }
    const mapped = input.map(k => this.normalizeKey(k));
    const valid = mapped.filter(k => DEFAULT_COLUMN_ORDER.includes(k));
    const missing = DEFAULT_COLUMN_ORDER.filter(k => !valid.includes(k));
    return [...valid, ...missing];
  }
}
