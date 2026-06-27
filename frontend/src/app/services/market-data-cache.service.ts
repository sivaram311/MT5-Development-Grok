import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { GridCacheService } from './grid-cache.service';

interface CacheEntry {
  data: unknown[];
  expires: number;
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
    const key = this.cacheKey(timeframe, limit, nySessionOnly);
    const mem = this.memory.get(key);
    if (mem && Date.now() < mem.expires) {
      return of(mem.data as any[]);
    }

    const url = `${environment.apiUrl}/market/xauusd/${timeframe}/grid?limit=${limit}&ny_session_only=${nySessionOnly}`;
    return this.http.get<any[]>(url).pipe(
      tap(data => {
        const rows = data || [];
        this.memory.set(key, { data: rows, expires: Date.now() + 60_000 });
        this.gridCache.put(key, rows).catch(() => undefined);
      })
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
}
