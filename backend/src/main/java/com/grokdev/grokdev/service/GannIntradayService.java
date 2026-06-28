package com.grokdev.grokdev.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class GannIntradayService {

    private static final String SCHEMA = "grok_dev";
    private static final int GRID_LIMIT = 120;

    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final MarketDataService marketDataService;
    private final GannIntradayCalculator calculator;

    @Autowired
    public GannIntradayService(
            org.springframework.jdbc.core.JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            MarketDataService marketDataService,
            GannIntradayCalculator calculator) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.marketDataService = marketDataService;
        this.calculator = calculator;
    }

    public Map<String, Object> getSnapshot(
            String entryTf,
            String so9Pivot,
            double timeScale,
            double atrThreshold,
            boolean preferLive) {

        if (preferLive) {
            Map<String, Object> live = readLiveSnapshot();
            if (live != null && Boolean.TRUE.equals(live.get("live"))) {
                return live;
            }
        }

        Map<String, Object> computed = computeFromGrid(entryTf, so9Pivot, timeScale, atrThreshold);
        if (computed != null) {
            computed.put("streamConnected", false);
            return computed;
        }

        Map<String, Object> offline = readLiveSnapshot();
        if (offline != null) {
            return offline;
        }

        return offlineSnapshot("Could not compute Gann intraday study — check grid data");
    }

    public Map<String, Object> computeFromGrid(
            String entryTf, String so9Pivot, double timeScale, double atrThreshold) {
        try {
            var entry = marketDataService.getXauusdGridData(entryTf, GRID_LIMIT, false);
            var m15 = marketDataService.getXauusdGridData("M15", GRID_LIMIT, false);
            var d1 = marketDataService.getXauusdGridData("D1", 30, false);
            Map<String, Object> study = calculator.compute(
                    entryTf, entry, m15, d1, so9Pivot, timeScale, atrThreshold);
            if (study != null) {
                study.put("updatedAt", Instant.now().toString());
            }
            return study;
        } catch (Exception ex) {
            return null;
        }
    }

    public Map<String, Object> readLiveSnapshot() {
        String sql = String.format(
                "SELECT payload, updated_at FROM %s.live_gann_intraday WHERE id = 1", SCHEMA);
        try {
            return jdbcTemplate.query(sql, rs -> {
                if (!rs.next()) {
                    return null;
                }
                String json = rs.getString("payload");
                Timestamp updatedAt = rs.getTimestamp("updated_at");
                try {
                    Map<String, Object> payload = objectMapper.readValue(json, new TypeReference<>() {});
                    payload.put("updatedAt", updatedAt != null ? updatedAt.toInstant().toString() : null);
                    payload.put("streamConnected", true);
                    payload.put("source", "live");
                    return payload;
                } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
                    return offlineSnapshot("Invalid Gann intraday JSON in database");
                }
            });
        } catch (Exception ex) {
            return null;
        }
    }

    public Instant getSnapshotUpdatedAt() {
        String sql = String.format("SELECT updated_at FROM %s.live_gann_intraday WHERE id = 1", SCHEMA);
        try {
            Timestamp ts = jdbcTemplate.queryForObject(sql, Timestamp.class);
            return ts != null ? ts.toInstant() : null;
        } catch (Exception ex) {
            return null;
        }
    }

    private Map<String, Object> offlineSnapshot(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("live", false);
        body.put("message", message);
        body.put("symbol", "XAUUSD");
        body.put("reversalAlert", Map.of("severity", "none", "active", false, "reasons", List.of(), "setup", message));
        body.put("updatedAt", null);
        return body;
    }
}
