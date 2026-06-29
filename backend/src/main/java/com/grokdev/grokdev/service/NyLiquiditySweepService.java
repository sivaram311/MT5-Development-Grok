package com.grokdev.grokdev.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grokdev.grokdev.model.market.XauusdCandle;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class NyLiquiditySweepService {

    private static final String SCHEMA = "grok_dev";
    private static final int GRID_LIMIT = 5000;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final MarketDataService marketDataService;
    private final NyLiquiditySweepCalculator calculator;

    @Autowired
    public NyLiquiditySweepService(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            MarketDataService marketDataService,
            NyLiquiditySweepCalculator calculator) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.marketDataService = marketDataService;
        this.calculator = calculator;
    }

    public Map<String, Object> getLiveSnapshot(boolean preferLive) {
        if (preferLive) {
            Map<String, Object> live = readLiveSnapshot();
            if (live != null && Boolean.TRUE.equals(live.get("live"))) {
                return live;
            }
        }
        Map<String, Object> computed = computeLiveFromGrid();
        if (computed != null) {
            computed.put("streamConnected", false);
            computed.put("source", "computed");
            return computed;
        }
        Map<String, Object> offline = readLiveSnapshot();
        if (offline != null) {
            return offline;
        }
        return offlineSnapshot("No NY liquidity sweep data — run python run_ny_liquidity_sweep.py --live");
    }

    public Map<String, Object> readLiveSnapshot() {
        ensureTables();
        String sql = String.format("SELECT payload, updated_at FROM %s.live_ny_liquidity_sweep WHERE id = 1", SCHEMA);
        try {
            return jdbcTemplate.query(sql, rs -> {
                if (!rs.next()) {
                    return null;
                }
                try {
                    Map<String, Object> payload = objectMapper.readValue(rs.getString("payload"), new TypeReference<>() {});
                    Timestamp updatedAt = rs.getTimestamp("updated_at");
                    payload.put("updatedAt", updatedAt != null ? updatedAt.toInstant().toString() : null);
                    payload.put("streamConnected", true);
                    payload.put("source", "live");
                    return payload;
                } catch (Exception ex) {
                    return offlineSnapshot("Invalid live NY liquidity JSON");
                }
            });
        } catch (Exception ex) {
            return null;
        }
    }

    public Instant getSnapshotUpdatedAt() {
        ensureTables();
        String sql = String.format("SELECT updated_at FROM %s.live_ny_liquidity_sweep WHERE id = 1", SCHEMA);
        try {
            Timestamp ts = jdbcTemplate.queryForObject(sql, Timestamp.class);
            return ts != null ? ts.toInstant() : null;
        } catch (Exception ex) {
            return null;
        }
    }

    public List<Map<String, Object>> getHistoricalSetups(
            LocalDate from, LocalDate to, String direction, String result, Integer limit) {
        ensureTables();
        int max = limit != null && limit > 0 ? Math.min(limit, 1000) : 500;
        StringBuilder sql = new StringBuilder(String.format("""
                SELECT setup_id, setup_date, ny_time, ist_time, direction,
                       sweep_level, structure_level, entry, sl, tp1, tp2,
                       result, rr_achieved, rsi_htf, rsi_ltf, notes, how_spotted, payload
                FROM %s.liquidity_setups WHERE 1=1
                """, SCHEMA));
        List<Object> params = new ArrayList<>();
        if (from != null) {
            sql.append(" AND setup_date >= ?");
            params.add(Date.valueOf(from));
        }
        if (to != null) {
            sql.append(" AND setup_date <= ?");
            params.add(Date.valueOf(to));
        }
        if (direction != null && !direction.isBlank()) {
            sql.append(" AND direction = ?");
            params.add(direction);
        }
        if (result != null && !result.isBlank()) {
            sql.append(" AND result = ?");
            params.add(result);
        }
        sql.append(" ORDER BY setup_date DESC, ny_time DESC LIMIT ?");
        params.add(max);

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> rowToSetup(rs), params.toArray());
    }

    public Map<String, Object> getStats() {
        ensureTables();
        List<Map<String, Object>> setups = getHistoricalSetups(null, null, null, null, 1000);
        long total = setups.size();
        long wins = setups.stream().filter(s -> "Win".equals(s.get("result"))).count();
        long losses = setups.stream().filter(s -> "Loss".equals(s.get("result"))).count();
        double avgRr = setups.stream()
                .map(s -> s.get("rr_achieved"))
                .filter(v -> v instanceof Number)
                .mapToDouble(v -> ((Number) v).doubleValue())
                .filter(v -> v > 0)
                .average()
                .orElse(0);

        Map<String, Long> byDay = setups.stream()
                .collect(Collectors.groupingBy(
                        s -> dayOfWeek(String.valueOf(s.get("date"))),
                        Collectors.counting()));

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalSetups", total);
        stats.put("wins", wins);
        stats.put("losses", losses);
        stats.put("openSetups", total - wins - losses);
        stats.put("winRate", total > 0 ? Math.round(wins * 1000.0 / total) / 10.0 : 0);
        stats.put("averageRr", Math.round(avgRr * 100.0) / 100.0);
        stats.put("byDayOfWeek", byDay);
        return stats;
    }

    public Map<String, Object> getChartData(String setupId) {
        ensureTables();
        List<Map<String, Object>> rows = jdbcTemplate.query(
                String.format("SELECT * FROM %s.liquidity_setups WHERE setup_id = ?", SCHEMA),
                (rs, rowNum) -> rowToSetup(rs),
                setupId);
        if (rows.isEmpty()) {
            return Map.of("error", "Setup not found");
        }
        Map<String, Object> setup = rows.get(0);
        String date = String.valueOf(setup.get("date"));
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = setup.get("payload") instanceof Map
                ? (Map<String, Object>) setup.get("payload")
                : Map.of();
        String entryTf = payload.get("entryTf") != null ? String.valueOf(payload.get("entryTf")) : "M15";
        int limit = "M1".equals(entryTf) ? 3000 : 2000;
        List<XauusdCandle> entryAsc = toAsc(marketDataService.getXauusdGridData(entryTf, limit, false));
        List<Map<String, Object>> candles = entryAsc.stream()
                .filter(c -> c.getTime() != null && c.getTime().toLocalDate().toString().equals(date)
                        || (c.getNyTime() != null && c.getNyTime().toLocalDate().toString().equals(date)))
                .map(this::candleToMap)
                .collect(Collectors.toList());

        if (candles.size() < 20) {
            int take = Math.min("M1".equals(entryTf) ? 360 : 180, entryAsc.size());
            candles = entryAsc.subList(Math.max(0, entryAsc.size() - take), entryAsc.size()).stream()
                    .map(this::candleToMap)
                    .collect(Collectors.toList());
        }

        Map<String, Object> chart = new LinkedHashMap<>();
        chart.put("setup", setup);
        chart.put("candles", candles);
        chart.put("entryTf", entryTf);
        chart.put("levels", Map.of(
                "sweep", setup.get("sweep_level"),
                "structure", setup.get("structure_level"),
                "entry", setup.get("entry"),
                "sl", setup.get("sl"),
                "tp1", setup.get("tp1"),
                "tp2", setup.get("tp2")
        ));
        chart.put("sweepTime", payload.get("sweepTime"));
        chart.put("structureTime", payload.get("structureTime"));
        return chart;
    }

    public List<Map<String, String>> getTfPresets() {
        return List.of(
                Map.of("id", "h1-m15-m15", "label", "H1 → M15 (M15 entry)", "htf", "H1", "ltf", "M15", "entry", "M15"),
                Map.of("id", "h1-m1-m1", "label", "H1 → M1 (M1 entry)", "htf", "H1", "ltf", "M1", "entry", "M1"),
                Map.of("id", "m15-m1-m1", "label", "M15 → M1 (M1 entry)", "htf", "M15", "ltf", "M1", "entry", "M1"),
                Map.of("id", "h4-m15-m15", "label", "H4 → M15 (M15 entry)", "htf", "H4", "ltf", "M15", "entry", "M15"),
                Map.of("id", "h4-m1-m1", "label", "H4 → M1 (M1 entry)", "htf", "H4", "ltf", "M1", "entry", "M1")
        );
    }

    public Map<String, Object> scanFromGrid(int days, String entryTf, String htf, String ltf) {
        ensureTables();
        NyLiquiditySweepCalculator.TfConfig config = NyLiquiditySweepCalculator.TfConfig.of(entryTf, htf, ltf);
        Map<String, List<XauusdCandle>> tfBars = loadTfBars(config);
        int entryLimit = "M1".equals(config.entryTf()) ? 15000 : GRID_LIMIT;
        List<XauusdCandle> entryAsc = toAsc(marketDataService.getXauusdGridData(config.entryTf(), entryLimit, false));
        List<XauusdCandle> d1Asc = tfBars.getOrDefault("D1", List.of());

        List<Map<String, Object>> detected = calculator.scanRecentDays(entryAsc, tfBars, d1Asc, days, config);
        int upserted = 0;
        for (Map<String, Object> setup : detected) {
            upsertSetup(setup);
            upserted++;
        }
        return Map.of(
                "scanned", true,
                "days", days,
                "entryTf", config.entryTf(),
                "htf", config.htf(),
                "ltf", config.ltf(),
                "detected", detected.size(),
                "upserted", upserted,
                "message", "Grid scan complete. For full accuracy run: python run_ny_liquidity_sweep.py --backfill"
        );
    }

    private Map<String, List<XauusdCandle>> loadTfBars(NyLiquiditySweepCalculator.TfConfig config) {
        Map<String, Integer> limits = Map.of(
                "M1", 15000,
                "M15", 2000,
                "H1", 1000,
                "H4", 500,
                "D1", 120
        );
        Map<String, List<XauusdCandle>> tfBars = new LinkedHashMap<>();
        tfBars.put("M15", toAsc(marketDataService.getXauusdGridData("M15", limits.get("M15"), false)));
        tfBars.put(config.htf(), toAsc(marketDataService.getXauusdGridData(config.htf(), limits.getOrDefault(config.htf(), 1000), false)));
        tfBars.put(config.ltf(), toAsc(marketDataService.getXauusdGridData(config.ltf(), limits.getOrDefault(config.ltf(), 2000), false)));
        if ("M1".equals(config.entryTf()) && !tfBars.containsKey("M1")) {
            tfBars.put("M1", toAsc(marketDataService.getXauusdGridData("M1", limits.get("M1"), false)));
        }
        tfBars.put("D1", toAsc(marketDataService.getXauusdGridData("D1", limits.get("D1"), false)));
        return tfBars;
    }

    private Map<String, Object> computeLiveFromGrid() {
        NyLiquiditySweepCalculator.TfConfig config = NyLiquiditySweepCalculator.TfConfig.defaults();
        Map<String, List<XauusdCandle>> tfBars = loadTfBars(config);
        int tail = 800;
        List<XauusdCandle> entryAsc = toAsc(marketDataService.getXauusdGridData(config.entryTf(), tail, false));
        List<XauusdCandle> d1Asc = tfBars.getOrDefault("D1", List.of());
        return calculator.detectLive(entryAsc, tfBars, d1Asc, config);
    }

    private void upsertSetup(Map<String, Object> setup) {
        String sql = String.format("""
            INSERT INTO %s.liquidity_setups (
                setup_id, setup_date, ny_time, ist_time, direction,
                sweep_level, structure_level, entry, sl, tp1, tp2,
                result, rr_achieved, rsi_htf, rsi_ltf, notes, how_spotted, payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
            ON CONFLICT (setup_id) DO UPDATE SET
                result = EXCLUDED.result, rr_achieved = EXCLUDED.rr_achieved, payload = EXCLUDED.payload
            """, SCHEMA);
        try {
            jdbcTemplate.update(sql,
                    setup.get("setup_id"),
                    Date.valueOf(LocalDate.parse(String.valueOf(setup.get("date")))),
                    setup.get("ny_time"),
                    setup.get("ist_time"),
                    setup.get("direction"),
                    setup.get("sweep_level"),
                    setup.get("structure_level"),
                    setup.get("entry"),
                    setup.get("sl"),
                    setup.get("tp1"),
                    setup.get("tp2"),
                    setup.get("result"),
                    setup.get("rr_achieved"),
                    setup.get("rsi_htf"),
                    setup.get("rsi_ltf"),
                    setup.get("notes"),
                    setup.get("how_spotted"),
                    objectMapper.writeValueAsString(setup.getOrDefault("payload", Map.of())));
        } catch (Exception ignored) {
            // best effort
        }
    }

    private void ensureTables() {
        jdbcTemplate.execute(String.format("""
            CREATE TABLE IF NOT EXISTS %s.liquidity_setups (
                setup_id VARCHAR(64) PRIMARY KEY,
                setup_date DATE NOT NULL,
                ny_time VARCHAR(16),
                ist_time VARCHAR(16),
                direction VARCHAR(16) NOT NULL,
                sweep_level NUMERIC(12, 5),
                structure_level NUMERIC(12, 5),
                entry NUMERIC(12, 5),
                sl NUMERIC(12, 5),
                tp1 NUMERIC(12, 5),
                tp2 NUMERIC(12, 5),
                result VARCHAR(16),
                rr_achieved NUMERIC(8, 2),
                rsi_htf NUMERIC(8, 2),
                rsi_ltf NUMERIC(8, 2),
                notes TEXT,
                how_spotted TEXT,
                payload JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """, SCHEMA));
        jdbcTemplate.execute(String.format("""
            CREATE TABLE IF NOT EXISTS %s.live_ny_liquidity_sweep (
                id SMALLINT PRIMARY KEY DEFAULT 1,
                payload JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT live_ny_liquidity_sweep_singleton CHECK (id = 1)
            )
            """, SCHEMA));
    }

    private List<XauusdCandle> toAsc(List<XauusdCandle> desc) {
        if (desc == null || desc.isEmpty()) {
            return List.of();
        }
        List<XauusdCandle> copy = new ArrayList<>(desc);
        copy.sort(Comparator.comparing(XauusdCandle::getTime));
        return copy;
    }

    private Map<String, Object> candleToMap(XauusdCandle c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("time", c.getTime() != null ? c.getTime().toString() : null);
        m.put("nyTime", c.getNyTime() != null ? c.getNyTime().toString() : null);
        m.put("istTime", c.getIstTime() != null ? c.getIstTime().toString() : null);
        m.put("open", toDouble(c.getOpen()));
        m.put("high", toDouble(c.getHigh()));
        m.put("low", toDouble(c.getLow()));
        m.put("close", toDouble(c.getClose()));
        m.put("rsi", c.getRsi());
        return m;
    }

    private Map<String, Object> rowToSetup(java.sql.ResultSet rs) throws java.sql.SQLException {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("setup_id", rs.getString("setup_id"));
        row.put("date", rs.getDate("setup_date").toString());
        row.put("ny_time", rs.getString("ny_time"));
        row.put("ist_time", rs.getString("ist_time"));
        row.put("direction", rs.getString("direction"));
        row.put("sweep_level", rs.getBigDecimal("sweep_level"));
        row.put("structure_level", rs.getBigDecimal("structure_level"));
        row.put("entry", rs.getBigDecimal("entry"));
        row.put("sl", rs.getBigDecimal("sl"));
        row.put("tp1", rs.getBigDecimal("tp1"));
        row.put("tp2", rs.getBigDecimal("tp2"));
        row.put("result", rs.getString("result"));
        row.put("rr_achieved", rs.getBigDecimal("rr_achieved"));
        row.put("rsi_htf", rs.getBigDecimal("rsi_htf"));
        row.put("rsi_ltf", rs.getBigDecimal("rsi_ltf"));
        row.put("notes", rs.getString("notes"));
        row.put("how_spotted", rs.getString("how_spotted"));
        try {
            String payload = rs.getString("payload");
            row.put("payload", payload != null ? objectMapper.readValue(payload, new TypeReference<>() {}) : Map.of());
        } catch (Exception ex) {
            row.put("payload", Map.of());
        }
        return row;
    }

    private static double toDouble(BigDecimal v) {
        return v != null ? v.doubleValue() : 0;
    }

    private static String dayOfWeek(String dateStr) {
        try {
            return LocalDate.parse(dateStr).getDayOfWeek().name().substring(0, 3);
        } catch (Exception ex) {
            return "—";
        }
    }

    private Map<String, Object> offlineSnapshot(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("live", false);
        body.put("message", message);
        body.put("symbol", "XAUUSD");
        body.put("updatedAt", null);
        return body;
    }
}
