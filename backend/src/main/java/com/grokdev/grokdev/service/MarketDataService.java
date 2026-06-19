package com.grokdev.grokdev.service;

import com.grokdev.grokdev.model.market.XauusdCandle;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MarketDataService {

    private final JdbcTemplate jdbcTemplate;

    private static final String SCHEMA = "grok_dev";

    @Autowired
    public MarketDataService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<XauusdCandle> getXauusdData(String timeframe, LocalDateTime from, LocalDateTime to, int limit) {
        String tableName = "XAUUSD_" + timeframe.toUpperCase();
        String sql = String.format(
                "SELECT time, open, high, low, close, tick_volume, spread, real_volume " +
                "FROM %s.\"%s\" " +
                "WHERE 1=1 ",
                SCHEMA, tableName
        );

        StringBuilder where = new StringBuilder();
        List<Object> paramsList = new ArrayList<>();

        if (from != null) {
            where.append(" AND time >= ? ");
            paramsList.add(from);
        }
        if (to != null) {
            where.append(" AND time <= ? ");
            paramsList.add(to);
        }
        sql += where.toString();
        sql += " ORDER BY time DESC LIMIT ?";
        paramsList.add(limit);

        Object[] params = paramsList.toArray();

        RowMapper<XauusdCandle> rowMapper = (rs, rowNum) -> XauusdCandle.builder()
                .time(rs.getTimestamp("time").toLocalDateTime())
                .open(rs.getBigDecimal("open"))
                .high(rs.getBigDecimal("high"))
                .low(rs.getBigDecimal("low"))
                .close(rs.getBigDecimal("close"))
                .tickVolume(rs.getLong("tick_volume"))
                .spread(rs.getInt("spread"))
                .realVolume(rs.getLong("real_volume"))
                .build();

        List<XauusdCandle> data = jdbcTemplate.query(sql, rowMapper, params);

        // Enrich with NY / IST times (useful for Data Grid and other views)
        enrichTimezoneFields(data);

        // Return DESC (newest first) so grids and recent views show latest data first
        return data;
    }

    public List<XauusdCandle> getLatestXauusdData(String timeframe, int limit) {
        return getXauusdData(timeframe, null, null, limit);
    }

    public List<XauusdCandle> getXauusdGridData(String timeframe, int limit) {
        // Fetch extra bars for RSI calculation (14 period + buffer)
        int rsiPeriod = 14;
        int extra = rsiPeriod + 5;
        List<XauusdCandle> candles = getXauusdData(timeframe, null, null, limit + extra);

        // getXauusdData returns DESC (newest first) - reverse to ASC for sequential RSI calc
        Collections.reverse(candles);

        if (candles.size() > rsiPeriod) {
            calculateRSI(candles, rsiPeriod);
        }

        // Add broker / NY / IST times for the Data Grid UI
        enrichTimezoneFields(candles);

        // Return the most recent 'limit' candles in DESC order (newest first)
        if (candles.size() > limit) {
            List<XauusdCandle> recent = candles.subList(candles.size() - limit, candles.size());
            Collections.reverse(recent); // DESC newest first
            return recent;
        }
        // If less than limit, reverse back to DESC
        Collections.reverse(candles);
        return candles;
    }

    /**
     * Enrich grid candles with timezone-converted times for the Data Grid.
     * Assumes the stored 'time' (broker time) represents a UTC instant for conversion.
     * - time      : Broker time (unchanged)
     * - nyTime    : New York time
     * - istTime   : India (Kolkata) time
     */
    private void enrichTimezoneFields(List<XauusdCandle> candles) {
        if (candles == null || candles.isEmpty()) return;

        ZoneId baseZone = ZoneId.of("UTC");           // base assumption for stored bar times
        ZoneId nyZone   = ZoneId.of("America/New_York");
        ZoneId istZone  = ZoneId.of("Asia/Kolkata");

        for (XauusdCandle c : candles) {
            LocalDateTime brokerTime = c.getTime();
            if (brokerTime != null) {
                ZonedDateTime zdt = brokerTime.atZone(baseZone);
                c.setNyTime( zdt.withZoneSameInstant(nyZone).toLocalDateTime() );
                c.setIstTime( zdt.withZoneSameInstant(istZone).toLocalDateTime() );
            }
        }
    }

    private void calculateRSI(List<XauusdCandle> candles, int period) {
        if (candles.size() <= period) return;

        // Ensure ascending by time (already is from query)
        double[] gains = new double[candles.size()];
        double[] losses = new double[candles.size()];

        for (int i = 1; i < candles.size(); i++) {
            double change = candles.get(i).getClose().doubleValue() - candles.get(i - 1).getClose().doubleValue();
            gains[i] = Math.max(change, 0);
            losses[i] = Math.max(-change, 0);
        }

        // Initial average
        double avgGain = 0;
        double avgLoss = 0;
        for (int i = 1; i <= period; i++) {
            avgGain += gains[i];
            avgLoss += losses[i];
        }
        avgGain /= period;
        avgLoss /= period;

        for (int i = period; i < candles.size(); i++) {
            double rs = (avgLoss == 0) ? 100 : avgGain / avgLoss;
            double rsi = 100 - (100 / (1 + rs));
            candles.get(i).setRsi(rsi);

            // Wilder smoothing
            avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
            avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
        }
    }

    public Map<String, Object> getSyncStatus() {
        String sql = "SELECT timeframe, last_candle_time, last_synced FROM grok_dev.sync_status ORDER BY timeframe";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> row = new HashMap<>();
            row.put("timeframe", rs.getString("timeframe"));
            row.put("lastCandleTime", rs.getTimestamp("last_candle_time"));
            row.put("lastSynced", rs.getTimestamp("last_synced"));
            return row;
        }).stream().collect(Collectors.toMap(
            m -> (String) m.get("timeframe"),
            m -> m
        ));
    }

    private boolean isFreshForTimeframe(String tf, java.time.LocalDateTime lastCandle) {
        if (lastCandle == null) return false;
        long ageMinutes = java.time.Duration.between(lastCandle, java.time.LocalDateTime.now()).toMinutes();
        Map<String, Long> thresholdsMin = Map.of(
            "M1", 2L,
            "M5", 7L,
            "M15", 20L,
            "H1", 70L,
            "H4", 4 * 60 + 30L,
            "D1", 25 * 60L
        );
        long thresh = thresholdsMin.getOrDefault(tf, 60L);
        return ageMinutes < thresh;
    }

    /**
     * Health check for market data freshness.
     * Real per-TF thresholds + overall status.
     * Powers dedicated Health Dashboard.
     */
    public Map<String, Object> getMarketDataHealth() {
        Map<String, Object> health = new HashMap<>();
        Map<String, Object> rawStatus = getSyncStatus();

        boolean allFresh = true;
        int freshCount = 0;
        Map<String, Object> details = new HashMap<>();

        for (Map.Entry<String, Object> entry : rawStatus.entrySet()) {
            String tf = entry.getKey();
            @SuppressWarnings("unchecked")
            Map<String, Object> info = (Map<String, Object>) entry.getValue();
            Object lastTs = info.get("lastCandleTime");
            Object lastSyncedTs = info.get("lastSynced");

            java.time.LocalDateTime lastCandle = null;
            if (lastTs instanceof java.sql.Timestamp) {
                lastCandle = ((java.sql.Timestamp) lastTs).toLocalDateTime();
            }

            boolean fresh = isFreshForTimeframe(tf, lastCandle);
            if (fresh) freshCount++;
            else allFresh = false;

            Map<String, Object> detail = new HashMap<>();
            detail.put("lastCandleTime", lastTs);
            detail.put("lastSynced", lastSyncedTs);
            detail.put("fresh", fresh);
            details.put(tf, detail);
        }

        health.put("status", allFresh ? "UP" : (freshCount > 0 ? "DEGRADED" : "DOWN"));
        health.put("freshCount", freshCount);
        health.put("total", rawStatus.size() > 0 ? rawStatus.size() : 6);
        health.put("details", details);
        health.put("checkedAt", java.time.LocalDateTime.now());
        return health;
    }
}
