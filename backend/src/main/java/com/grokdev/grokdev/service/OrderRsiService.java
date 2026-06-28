package com.grokdev.grokdev.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class OrderRsiService {

    private static final String SCHEMA = "grok_dev";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public OrderRsiService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> getLiveSnapshot() {
        String sql = String.format(
                "SELECT payload, updated_at FROM %s.live_order_rsi WHERE id = 1",
                SCHEMA
        );
        try {
            return jdbcTemplate.query(sql, rs -> {
                if (!rs.next()) {
                    return offlineSnapshot("No live Order RSI snapshot yet — start python run_order_rsi.py");
                }
                String json = rs.getString("payload");
                Timestamp updatedAt = rs.getTimestamp("updated_at");
                try {
                    Map<String, Object> payload = objectMapper.readValue(json, new TypeReference<>() {});
                    payload.put("updatedAt", updatedAt != null ? updatedAt.toInstant().toString() : null);
                    payload.put("streamConnected", true);
                    return payload;
                } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
                    return offlineSnapshot("Invalid Order RSI JSON in database");
                }
            });
        } catch (Exception ex) {
            return offlineSnapshot("Failed to read Order RSI snapshot: " + ex.getMessage());
        }
    }

    public Instant getSnapshotUpdatedAt() {
        String sql = String.format("SELECT updated_at FROM %s.live_order_rsi WHERE id = 1", SCHEMA);
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
        body.put("asOf", Map.of("broker", "", "ny", "", "ist", ""));
        body.put("price", null);
        body.put("timeframes", Map.of());
        body.put("updatedAt", null);
        return body;
    }
}
