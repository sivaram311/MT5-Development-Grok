package com.grokdev.grokdev.service;

import com.grokdev.grokdev.model.market.XauusdCandle;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.Objects;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MarketDataService {

    private static final List<String> HEALTH_TIMEFRAMES = List.of("D1", "H4", "H1", "M15", "M5", "M1");
    /** Daemon considered live when last_synced is within this many minutes. */
    private static final long SYNC_LIVENESS_MINUTES = 15L;

    private final JdbcTemplate jdbcTemplate;

    private static final String SCHEMA = "grok_dev";

    @Value("${grok.market.broker-server-zone:UTC}")
    private String brokerServerZoneId;

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

    public List<XauusdCandle> getXauusdGridData(String timeframe, int limit, boolean nySessionOnly) {
        // Fetch extra bars for RSI calculation (14 period + buffer)
        int rsiPeriod = 14;
        int extra = rsiPeriod + 5;
        List<XauusdCandle> candles = getXauusdData(timeframe, null, null, limit + extra);

        // getXauusdData returns DESC (newest first) - reverse to ASC for sequential RSI calc
        Collections.reverse(candles);

        if (nySessionOnly) {
            if ("D1".equalsIgnoreCase(timeframe)) {
                // For D1 + NY session: fetch finer TF (M15), filter to NY session, aggregate per NY day
                // Pull enough recent M15 (~100 per calendar day) to synthesize up to 'limit' NY-session days.
                int m15Limit = Math.max((limit + extra) * 100, 20000);
                List<XauusdCandle> fine = getXauusdData("M15", null, null, m15Limit);
                Collections.reverse(fine); // ASC
                List<XauusdCandle> nyFine = filterToNySession(fine);
                candles = aggregateNySessionToDaily(nyFine);
            } else {
                candles = filterToNySession(candles);
            }
        }

        if (candles.size() > rsiPeriod) {
            calculateRSI(candles, rsiPeriod);
        }

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

    private List<XauusdCandle> filterToNySession(List<XauusdCandle> candles) {
        if (candles == null || candles.isEmpty()) return List.of();
        return candles.stream()
                .filter(c -> isInNySession(c.getNyTime()))
                .collect(Collectors.toList());
    }

    private boolean isInNySession(LocalDateTime nyTime) {
        if (nyTime == null) return false;
        int hour = nyTime.getHour();
        // Common NY session: 08:00 - 17:00 NY time (9 hours)
        return hour >= 8 && hour < 17;
    }

    private List<XauusdCandle> aggregateNySessionToDaily(List<XauusdCandle> fineCandles) {
        if (fineCandles == null || fineCandles.isEmpty()) return List.of();

        Map<LocalDate, List<XauusdCandle>> byNyDate = fineCandles.stream()
                .filter(c -> c.getNyTime() != null)
                .collect(Collectors.groupingBy(c -> c.getNyTime().toLocalDate()));

        List<XauusdCandle> daily = new ArrayList<>();
        for (List<XauusdCandle> dayBars : byNyDate.values()) {
            if (dayBars.isEmpty()) continue;
            dayBars.sort(Comparator.comparing(XauusdCandle::getTime));

            XauusdCandle agg = new XauusdCandle();
            agg.setTime(dayBars.get(0).getTime());
            agg.setOpen(dayBars.get(0).getOpen());
            agg.setHigh(dayBars.stream()
                    .map(XauusdCandle::getHigh)
                    .filter(Objects::nonNull)
                    .max(Comparator.naturalOrder())
                    .orElse(null));
            agg.setLow(dayBars.stream()
                    .map(XauusdCandle::getLow)
                    .filter(Objects::nonNull)
                    .min(Comparator.naturalOrder())
                    .orElse(null));
            agg.setClose(dayBars.get(dayBars.size() - 1).getClose());

            long volSum = dayBars.stream()
                    .mapToLong(c -> c.getTickVolume() != null ? c.getTickVolume() : 0L)
                    .sum();
            agg.setTickVolume(volSum);

            daily.add(agg);
        }
        daily.sort(Comparator.comparing(XauusdCandle::getTime));
        enrichTimezoneFields(daily);
        return daily;
    }

    /**
     * Enrich grid candles with timezone-converted times for the Data Grid.
     * The stored 'time' is the wall-clock time according to the MT5 broker server clock
     * (see grok.market.broker-server-zone).
     *
     * We treat the stored LocalDateTime as wall time in the broker's server zone to recover
     * the true instant, then convert that instant to NY / IST wall times.
     *
     * This ensures:
     *   - Correct nyTime for NY session filtering (08:00-17:00 NY) and D1 aggregation.
     *   - ny 08:00 EDT == IST 17:30 (5:30 PM) on summer dates (9.5h delta).
     *   - Zone rules handle DST automatically (EDT vs EST).
     *
     * - time      : Raw broker / MT5 server time (wall time, unchanged)
     * - nyTime    : Wall time in New York (America/New_York)
     * - istTime   : Wall time in India (Asia/Kolkata)
     */
    private void enrichTimezoneFields(List<XauusdCandle> candles) {
        if (candles == null || candles.isEmpty()) return;

        ZoneId serverZone = ZoneId.of(brokerServerZoneId != null ? brokerServerZoneId : "UTC");
        ZoneId nyZone   = ZoneId.of("America/New_York");
        ZoneId istZone  = ZoneId.of("Asia/Kolkata");

        for (XauusdCandle c : candles) {
            LocalDateTime brokerWallTime = c.getTime();
            if (brokerWallTime != null) {
                // Broker wall time -> true instant (using server zone)
                ZonedDateTime serverZdt = brokerWallTime.atZone(serverZone);
                // True instant -> wall time in target zones
                c.setNyTime( serverZdt.withZoneSameInstant(nyZone).toLocalDateTime() );
                c.setIstTime( serverZdt.withZoneSameInstant(istZone).toLocalDateTime() );
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
            m -> m,
            (a, b) -> a
        ));
    }

    /**
     * Fallback when sync_status.last_candle_time is null but candle rows exist.
     */
    private LocalDateTime getMaxCandleTimeFromTable(String tf) {
        String tableName = "XAUUSD_" + tf.toUpperCase();
        String sql = String.format("SELECT MAX(time) AS max_time FROM %s.\"%s\"", SCHEMA, tableName);
        try {
            return jdbcTemplate.query(sql, rs -> {
                if (rs.next() && rs.getTimestamp("max_time") != null) {
                    return rs.getTimestamp("max_time").toLocalDateTime();
                }
                return null;
            });
        } catch (Exception ex) {
            return null;
        }
    }

    private long candleAgeMinutes(LocalDateTime lastCandle) {
        if (lastCandle == null) {
            return Long.MAX_VALUE;
        }
        ZoneId zone = ZoneId.of(brokerServerZoneId);
        ZonedDateTime candle = lastCandle.atZone(zone);
        return java.time.Duration.between(candle, ZonedDateTime.now(zone)).toMinutes();
    }

    private long syncAgeMinutes(Object lastSyncedTs) {
        if (!(lastSyncedTs instanceof java.sql.Timestamp)) {
            return Long.MAX_VALUE;
        }
        java.time.Instant synced = ((java.sql.Timestamp) lastSyncedTs).toInstant();
        return java.time.Duration.between(synced, java.time.Instant.now()).toMinutes();
    }

    private boolean isSyncLive(Object lastSyncedTs) {
        return syncAgeMinutes(lastSyncedTs) < SYNC_LIVENESS_MINUTES;
    }

    private long freshnessThresholdMinutes(String tf) {
        Map<String, Long> thresholdsMin = Map.of(
            "M1", 2L,
            "M5", 7L,
            "M15", 20L,
            "H1", 70L,
            "H4", 4 * 60 + 30L,
            "D1", 25 * 60L
        );
        return thresholdsMin.getOrDefault(tf, 60L);
    }

    private boolean isFreshForTimeframe(String tf, LocalDateTime lastCandle) {
        if (lastCandle == null) {
            return false;
        }
        return candleAgeMinutes(lastCandle) < freshnessThresholdMinutes(tf);
    }

    /**
     * Health check for market data freshness.
     * Real per-TF thresholds + overall status.
     * Powers dedicated Health Dashboard.
     */
    public Map<String, Object> getMarketDataHealth() {
        Map<String, Object> health = new HashMap<>();
        Map<String, Object> rawStatus = getSyncStatus();

        int freshCount = 0;
        int syncLiveCount = 0;
        Map<String, Object> details = new HashMap<>();

        for (String tf : HEALTH_TIMEFRAMES) {
            @SuppressWarnings("unchecked")
            Map<String, Object> info = rawStatus.containsKey(tf)
                    ? (Map<String, Object>) rawStatus.get(tf)
                    : new HashMap<>();

            Object lastTs = info.get("lastCandleTime");
            Object lastSyncedTs = info.get("lastSynced");
            boolean backfilledFromTable = false;

            LocalDateTime lastCandle = null;
            if (lastTs instanceof java.sql.Timestamp) {
                lastCandle = ((java.sql.Timestamp) lastTs).toLocalDateTime();
            }

            if (lastCandle == null) {
                LocalDateTime tableMax = getMaxCandleTimeFromTable(tf);
                if (tableMax != null) {
                    lastCandle = tableMax;
                    lastTs = java.sql.Timestamp.valueOf(tableMax);
                    backfilledFromTable = true;
                }
            }

            boolean syncLive = isSyncLive(lastSyncedTs);
            if (syncLive) {
                syncLiveCount++;
            }

            long ageMinutes = candleAgeMinutes(lastCandle);
            long thresholdMinutes = freshnessThresholdMinutes(tf);
            boolean fresh = isFreshForTimeframe(tf, lastCandle);
            if (fresh) {
                freshCount++;
            }

            Map<String, Object> detail = new HashMap<>();
            detail.put("lastCandleTime", lastTs);
            detail.put("lastSynced", lastSyncedTs);
            detail.put("fresh", fresh);
            detail.put("syncLive", syncLive);
            detail.put("ageMinutes", ageMinutes == Long.MAX_VALUE ? null : ageMinutes);
            detail.put("thresholdMinutes", thresholdMinutes);
            if (backfilledFromTable) {
                detail.put("source", "table_max");
            }
            details.put(tf, detail);
        }

        int total = HEALTH_TIMEFRAMES.size();
        boolean pipelineLive = syncLiveCount > 0;
        boolean anyCandleData = details.values().stream()
                .anyMatch(d -> ((Map<?, ?>) d).get("lastCandleTime") != null);

        String status;
        String message;
        if (!pipelineLive) {
            status = "DOWN";
            message = "Downloader not syncing — check MT5 login and python run_data_downloader.py";
        } else if (freshCount == total) {
            status = "UP";
            message = "All timeframes fresh";
        } else if (anyCandleData) {
            status = "DEGRADED";
            message = "Pipeline live — " + freshCount + "/" + total + " timeframes fresh (market closed or candles aging)";
        } else {
            status = "DOWN";
            message = "No candle data in database yet";
        }

        health.put("status", status);
        health.put("message", message);
        health.put("pipelineLive", pipelineLive);
        health.put("syncLiveCount", syncLiveCount);
        health.put("freshCount", freshCount);
        health.put("total", total);
        health.put("details", details);
        health.put("checkedAt", LocalDateTime.now());
        health.put("brokerTimeZone", brokerServerZoneId);
        return health;
    }
}
