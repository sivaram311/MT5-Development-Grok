package com.grokdev.grokdev.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Shared health snapshot for SSE subscribers — one DB poll serves all clients.
 */
@Service
public class HealthSnapshotService {

    private static final long CACHE_TTL_MS = 15_000;

    private final MarketDataService marketDataService;
    private final AtomicReference<Map<String, Object>> cached = new AtomicReference<>();
    private volatile long cachedAt = 0;

    public HealthSnapshotService(MarketDataService marketDataService) {
        this.marketDataService = marketDataService;
    }

    public Map<String, Object> getHealthSnapshot() {
        long now = System.currentTimeMillis();
        if (cached.get() != null && (now - cachedAt) < CACHE_TTL_MS) {
            return cached.get();
        }
        Map<String, Object> fresh = marketDataService.getMarketDataHealth();
        cached.set(fresh);
        cachedAt = now;
        return fresh;
    }
}
