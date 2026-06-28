import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, from, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { GridCacheService } from './grid-cache.service';

interface CacheEntry {
  data: unknown[];
  expires: number;
}

export interface GridFetchResult {
  rows: any[];
  fromCache: boolean;
  offline: boolean;
}

@Injectable({ providedIn: 'root' })
export class MarketDataCacheService {
  private memory = new Map<string, CacheEntry>();

  constructor(
    private http: HttpClient,
    private gridCache: GridCacheService
  ) {}

  cacheKey(timeframe: string, limit: number, nySessionOnly: boolean): string {
    return `${timeframe}:${limit}:${nySessionOnly}`;
  }

  fetchGrid(timeframe: string, limit: number, nySessionOnly: boolean): Observable<any[]> {
    return this.fetchGridWithFallback(timeframe, limit, nySessionOnly).pipe(
      map(result => result.rows)
    );
  }

  /** HTTP fetch with memory cache, IndexedDB persistence, and offline fallback. */
  fetchGridWithFallback(timeframe: string, limit: number, nySessionOnly: boolean): Observable<GridFetchResult> {
    const key = this.cacheKey(timeframe, limit, nySessionOnly);
    const mem = this.memory.get(key);
    if (mem && Date.now() < mem.expires) {
      return of({ rows: mem.data as any[], fromCache: true, offline: false });
    }

    const url = `${environment.apiUrl}/market/xauusd/${timeframe}/grid?limit=${limit}&ny_session_only=${nySessionOnly}`;
    return this.http.get<any[]>(url).pipe(
      tap(data => this.storeInCache(key, data || [])),
      map(data => ({ rows: data || [], fromCache: false, offline: false })),
      catchError(() =>
        from(this.getOfflineGrid(key)).pipe(
          map(cached => ({
            rows: cached || [],
            fromCache: false,
            offline: !!cached?.length
          }))
        )
      )
    );
  }

  async getOfflineGrid(key: string): Promise<any[] | null> {
    return this.gridCache.get<any>(key);
  }

  getMemoryCached(key: string): any[] | null {
    const mem = this.memory.get(key);
    if (!mem) return null;
    return mem.data as any[];
  }

  private storeInCache(key: string, rows: any[]): void {
    this.memory.set(key, { data: rows, expires: Date.now() + 60_000 });
    this.gridCache.put(key, rows).catch(() => undefined);
  }
}
