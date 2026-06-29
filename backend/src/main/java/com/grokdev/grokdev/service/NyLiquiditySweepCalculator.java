package com.grokdev.grokdev.service;

import com.grokdev.grokdev.model.market.XauusdCandle;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Server-side NY liquidity sweep detector (mirrors python/liquidity_sweep_analyzer.py).
 */
@Component
public class NyLiquiditySweepCalculator {

    private static final Pattern NY_PARTS = Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})[T ](\\d{2}):(\\d{2})");
    private static final double PIP = 0.10;
    private static final double SWEEP_BUF = 3 * PIP;
    private static final double STRUCT_TOL = 6 * PIP;
    private static final double RSI_HTF = 38.0;
    private static final double RSI_LTF = 35.0;
    private static final int MAX_AFTER_MIN = 90;
    private static final int OUTCOME_BARS_M5 = 48;

    private static final Map<String, Integer> TF_MINUTES = Map.of(
            "M1", 1,
            "M5", 5,
            "M15", 15,
            "H1", 60,
            "H4", 240,
            "D1", 1440
    );

    public record TfConfig(String entryTf, String htf, String ltf) {
        public static TfConfig defaults() {
            return new TfConfig("M15", "H1", "M15");
        }

        public static TfConfig of(String entryTf, String htf, String ltf) {
            String entry = entryTf != null && !entryTf.isBlank() ? entryTf.toUpperCase() : "M15";
            String h = htf != null && !htf.isBlank() ? htf.toUpperCase() : "H1";
            String l = ltf != null && !ltf.isBlank() ? ltf.toUpperCase() : "M15";
            if (!Set.of("M15", "M1").contains(entry)) {
                throw new IllegalArgumentException("entryTf must be M15 or M1");
            }
            if (!TF_MINUTES.containsKey(h) || !TF_MINUTES.containsKey(l)) {
                throw new IllegalArgumentException("Unsupported htf/ltf");
            }
            if (TF_MINUTES.get(h) <= TF_MINUTES.get(l)) {
                throw new IllegalArgumentException("htf must be higher than ltf");
            }
            if (TF_MINUTES.get(l) > TF_MINUTES.get(entry)) {
                throw new IllegalArgumentException("ltf cannot be higher than entry");
            }
            return new TfConfig(entry, h, l);
        }

        int barMinutes(String tf) {
            return TF_MINUTES.getOrDefault(tf, 5);
        }
    }

    public Map<String, Object> detectLive(
            List<XauusdCandle> entryBars,
            Map<String, List<XauusdCandle>> tfBars,
            List<XauusdCandle> d1,
            TfConfig config) {
        List<Map<String, Object>> setups = scanRecentDays(entryBars, tfBars, d1, 1, config);
        if (setups.isEmpty()) {
            return null;
        }
        Map<String, Object> latest = setups.get(setups.size() - 1);
        latest.put("live", true);
        latest.put("symbol", "XAUUSD");
        return latest;
    }

    public List<Map<String, Object>> scanRecentDays(
            List<XauusdCandle> entryBars,
            Map<String, List<XauusdCandle>> tfBars,
            List<XauusdCandle> d1,
            int days,
            TfConfig config) {
        if (entryBars == null || entryBars.size() < 50) {
            return List.of();
        }
        Map<LocalDate, List<XauusdCandle>> byNyDate = entryBars.stream()
                .filter(c -> c.getNyTime() != null && isInNySession(c.getNyTime()))
                .collect(Collectors.groupingBy(c -> c.getNyTime().toLocalDate()));

        List<LocalDate> dates = byNyDate.keySet().stream()
                .sorted(Comparator.reverseOrder())
                .limit(Math.max(1, days))
                .sorted()
                .collect(Collectors.toList());

        List<Map<String, Object>> all = new ArrayList<>();
        for (LocalDate date : dates) {
            List<XauusdCandle> dayEntry = byNyDate.get(date).stream()
                    .sorted(Comparator.comparing(XauusdCandle::getTime))
                    .collect(Collectors.toList());
            all.addAll(scanDay(dayEntry, entryBars, tfBars, d1, config));
        }
        return all;
    }

    private List<Map<String, Object>> scanDay(
            List<XauusdCandle> nyBars,
            List<XauusdCandle> allEntry,
            Map<String, List<XauusdCandle>> tfBars,
            List<XauusdCandle> d1,
            TfConfig config) {

        List<Map<String, Object>> setups = new ArrayList<>();
        if (nyBars.size() < 10) {
            return setups;
        }

        List<XauusdCandle> m15 = tfBars.getOrDefault("M15", List.of());
        List<XauusdCandle> htfBars = tfBars.getOrDefault(config.htf(), List.of());
        List<XauusdCandle> ltfBars = tfBars.getOrDefault(config.ltf(), List.of());
        int barMin = config.barMinutes(config.entryTf());
        int maxBars = Math.max(1, MAX_AFTER_MIN / barMin);
        int outcomeBars = Math.max(4, (OUTCOME_BARS_M5 * 5) / barMin);
        String howBase = "NY Sweep + Structure + " + config.htf() + "/" + config.ltf()
                + " RSI (" + config.entryTf() + " entry)";

        Map<String, Object> session = computeSessionPivots(d1, m15);
        if (session == null) {
            return setups;
        }

        Double pdl = toDoubleObj(session.get("pdl"));
        Double pdh = toDoubleObj(session.get("pdh"));
        LocalDate sessionDate = nyBars.get(0).getNyTime().toLocalDate();

        List<Swing> swingLows = findSwings(allEntry, true);
        List<Swing> swingHighs = findSwings(allEntry, false);

        double runningLow = toDouble(nyBars.get(0).getLow());
        double runningHigh = toDouble(nyBars.get(0).getHigh());

        for (int i = 0; i < nyBars.size(); i++) {
            XauusdCandle bar = nyBars.get(i);
            int barIdx = indexOfTime(allEntry, bar.getTime());
            if (barIdx < 0) {
                continue;
            }
            double low = toDouble(bar.getLow());
            double high = toDouble(bar.getHigh());
            runningLow = Math.min(runningLow, low);
            runningHigh = Math.max(runningHigh, high);

            List<Double> sigLows = new ArrayList<>();
            if (pdl != null) sigLows.add(pdl);
            if (i > 0) sigLows.add(runningLow);
            List<Double> sigHighs = new ArrayList<>();
            if (pdh != null) sigHighs.add(pdh);
            if (i > 0) sigHighs.add(runningHigh);

            for (Double sig : sigLows) {
                if (low < sig - SWEEP_BUF) {
                    Map<String, Object> setup = findBullishReturn(
                            bar, barIdx, allEntry, htfBars, ltfBars, swingLows, sig, sessionDate,
                            maxBars, outcomeBars, howBase, config);
                    if (setup != null) {
                        setups.add(setup);
                    }
                    break;
                }
            }
            for (Double sig : sigHighs) {
                if (high > sig + SWEEP_BUF) {
                    Map<String, Object> setup = findBearishReturn(
                            bar, barIdx, allEntry, htfBars, ltfBars, swingHighs, sig, sessionDate,
                            maxBars, outcomeBars, howBase, config);
                    if (setup != null) {
                        setups.add(setup);
                    }
                    break;
                }
            }
        }
        return setups;
    }

    private Map<String, Object> findBullishReturn(
            XauusdCandle sweepBar,
            int sweepIdx,
            List<XauusdCandle> entryBars,
            List<XauusdCandle> htfBars,
            List<XauusdCandle> ltfBars,
            List<Swing> swings,
            double sigLevel,
            LocalDate sessionDate,
            int maxBars,
            int outcomeBars,
            String howBase,
            TfConfig config) {

        double sweepLevel = toDouble(sweepBar.getLow());
        LocalDateTime sweepTime = sweepBar.getTime();

        for (int j = sweepIdx + 1; j < Math.min(entryBars.size(), sweepIdx + 1 + maxBars); j++) {
            XauusdCandle fb = entryBars.get(j);
            if (ChronoUnit.MINUTES.between(sweepTime, fb.getTime()) > MAX_AFTER_MIN) {
                break;
            }
            double close = toDouble(fb.getClose());
            for (Swing sw : swings) {
                if (sw.index >= sweepIdx) continue;
                if (Math.abs(close - sw.price) <= STRUCT_TOL) {
                    Double htfRsi = rsiAt(htfBars, fb.getTime());
                    Double ltfRsi = rsiAt(ltfBars, fb.getTime());
                    if (htfRsi == null || htfRsi <= RSI_HTF) continue;
                    if (ltfRsi == null || ltfRsi <= RSI_LTF) continue;
                    if (close <= sweepLevel) continue;

                    double entry = close + 2 * PIP;
                    double sl = sweepLevel - 4 * PIP;
                    double risk = entry - sl;
                    double tp1 = sw.price + risk * 1.5;
                    double tp2 = sw.price + risk * 2.5;
                    Outcome outcome = simulate(entryBars, j + 1, outcomeBars, true, entry, sl, tp1, tp2);

                    return buildSetup(
                            sessionDate, fb, "Bullish", sweepLevel, sw.price,
                            entry, sl, tp1, tp2, outcome, htfRsi, ltfRsi,
                            howBase,
                            "Sweep @ " + round2(sweepLevel) + "; structure " + round2(sw.price),
                            config);
                }
            }
        }
        return null;
    }

    private Map<String, Object> findBearishReturn(
            XauusdCandle sweepBar,
            int sweepIdx,
            List<XauusdCandle> entryBars,
            List<XauusdCandle> htfBars,
            List<XauusdCandle> ltfBars,
            List<Swing> swings,
            double sigLevel,
            LocalDate sessionDate,
            int maxBars,
            int outcomeBars,
            String howBase,
            TfConfig config) {

        double sweepLevel = toDouble(sweepBar.getHigh());
        LocalDateTime sweepTime = sweepBar.getTime();

        for (int j = sweepIdx + 1; j < Math.min(entryBars.size(), sweepIdx + 1 + maxBars); j++) {
            XauusdCandle fb = entryBars.get(j);
            if (ChronoUnit.MINUTES.between(sweepTime, fb.getTime()) > MAX_AFTER_MIN) {
                break;
            }
            double close = toDouble(fb.getClose());
            for (Swing sw : swings) {
                if (sw.index >= sweepIdx) continue;
                if (Math.abs(close - sw.price) <= STRUCT_TOL) {
                    Double htfRsi = rsiAt(htfBars, fb.getTime());
                    Double ltfRsi = rsiAt(ltfBars, fb.getTime());
                    if (htfRsi == null || htfRsi >= (100 - RSI_HTF)) continue;
                    if (ltfRsi == null || ltfRsi >= (100 - RSI_LTF)) continue;
                    if (close >= sweepLevel) continue;

                    double entry = close - 2 * PIP;
                    double sl = sweepLevel + 4 * PIP;
                    double risk = sl - entry;
                    double tp1 = sw.price - risk * 1.5;
                    double tp2 = sw.price - risk * 2.5;
                    Outcome outcome = simulate(entryBars, j + 1, outcomeBars, false, entry, sl, tp1, tp2);

                    return buildSetup(
                            sessionDate, fb, "Bearish", sweepLevel, sw.price,
                            entry, sl, tp1, tp2, outcome, htfRsi, ltfRsi,
                            howBase,
                            "Sweep @ " + round2(sweepLevel) + "; structure " + round2(sw.price),
                            config);
                }
            }
        }
        return null;
    }

    private Map<String, Object> buildSetup(
            LocalDate date, XauusdCandle structBar, String direction,
            double sweepLevel, double structLevel,
            double entry, double sl, double tp1, double tp2,
            Outcome outcome, Double htfRsi, Double ltfRsi,
            String howSpotted, String notes,
            TfConfig config) {

        String nyTime = structBar.getNyTime() != null
                ? String.format("%02d:%02d", structBar.getNyTime().getHour(), structBar.getNyTime().getMinute())
                : "";
        String istTime = structBar.getIstTime() != null
                ? String.format("%02d:%02d", structBar.getIstTime().getHour(), structBar.getIstTime().getMinute())
                : "";
        String setupId = "XAU_" + date + "_" + nyTime.replace(":", "") + "_" + direction.charAt(0)
                + "_" + config.entryTf();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("entryTf", config.entryTf());
        payload.put("htf", config.htf());
        payload.put("ltf", config.ltf());

        Map<String, Object> setup = new LinkedHashMap<>();
        setup.put("setup_id", setupId);
        setup.put("date", date.toString());
        setup.put("ny_time", nyTime);
        setup.put("ist_time", istTime);
        setup.put("direction", direction);
        setup.put("sweep_level", round2(sweepLevel));
        setup.put("structure_level", round2(structLevel));
        setup.put("entry", round2(entry));
        setup.put("sl", round2(sl));
        setup.put("tp1", round2(tp1));
        setup.put("tp2", round2(tp2));
        setup.put("result", outcome.result);
        setup.put("rr_achieved", outcome.rr);
        setup.put("rsi_htf", htfRsi != null ? round1(htfRsi) : null);
        setup.put("rsi_ltf", ltfRsi != null ? round1(ltfRsi) : null);
        setup.put("how_spotted", howSpotted);
        setup.put("notes", notes);
        setup.put("payload", payload);
        return setup;
    }

    private Outcome simulate(List<XauusdCandle> entryBars, int fromIdx, int outcomeBars, boolean bullish,
                             double entry, double sl, double tp1, double tp2) {
        double risk = Math.abs(entry - sl);
        if (risk <= 0) return new Outcome("Open", null);
        int end = Math.min(entryBars.size(), fromIdx + outcomeBars);
        for (int i = fromIdx; i < end; i++) {
            double high = toDouble(entryBars.get(i).getHigh());
            double low = toDouble(entryBars.get(i).getLow());
            if (bullish) {
                if (low <= sl) return new Outcome("Loss", -1.0);
                if (high >= tp2) return new Outcome("Win", round2((tp2 - entry) / risk));
                if (high >= tp1) return new Outcome("Win", round2((tp1 - entry) / risk));
            } else {
                if (high >= sl) return new Outcome("Loss", -1.0);
                if (low <= tp2) return new Outcome("Win", round2((entry - tp2) / risk));
                if (low <= tp1) return new Outcome("Win", round2((entry - tp1) / risk));
            }
        }
        return new Outcome("Open", null);
    }

    private Double rsiAt(List<XauusdCandle> bars, LocalDateTime target) {
        if (bars == null) return null;
        XauusdCandle match = null;
        for (XauusdCandle b : bars) {
            if (!b.getTime().isAfter(target)) {
                match = b;
            }
        }
        return match != null ? match.getRsi() : null;
    }

    private List<Swing> findSwings(List<XauusdCandle> bars, boolean lows) {
        List<Swing> out = new ArrayList<>();
        int lb = 2;
        for (int i = lb; i < bars.size() - lb; i++) {
            if (lows) {
                double low = toDouble(bars.get(i).getLow());
                boolean isMin = true;
                for (int j = i - lb; j <= i + lb; j++) {
                    if (j != i && toDouble(bars.get(j).getLow()) < low) isMin = false;
                }
                if (isMin) out.add(new Swing(i, low));
            } else {
                double high = toDouble(bars.get(i).getHigh());
                boolean isMax = true;
                for (int j = i - lb; j <= i + lb; j++) {
                    if (j != i && toDouble(bars.get(j).getHigh()) > high) isMax = false;
                }
                if (isMax) out.add(new Swing(i, high));
            }
        }
        return out.size() > 15 ? out.subList(out.size() - 15, out.size()) : out;
    }

    private Map<String, Object> computeSessionPivots(List<XauusdCandle> d1, List<XauusdCandle> m15) {
        if (d1 == null || d1.isEmpty()) return null;
        List<XauusdCandle> d1Desc = new ArrayList<>(d1);
        d1Desc.sort(Comparator.comparing(XauusdCandle::getTime).reversed());
        XauusdCandle prev = d1Desc.size() >= 2 ? d1Desc.get(1) : d1Desc.get(0);
        Map<String, Object> session = new LinkedHashMap<>();
        session.put("pdh", toDouble(prev.getHigh()));
        session.put("pdl", toDouble(prev.getLow()));
        session.put("prevClose", toDouble(prev.getClose()));
        return session;
    }

    private static double toDouble(BigDecimal v) {
        return v != null ? v.doubleValue() : 0;
    }

    private static Double toDoubleObj(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        return null;
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private static double round1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private static boolean isInNySession(LocalDateTime nyTime) {
        int hour = nyTime.getHour();
        return hour >= 8 && hour < 17;
    }

    private static int indexOfTime(List<XauusdCandle> bars, LocalDateTime time) {
        for (int i = 0; i < bars.size(); i++) {
            if (bars.get(i).getTime().equals(time)) {
                return i;
            }
        }
        return -1;
    }

    private record Swing(int index, double price) {}
    private record Outcome(String result, Double rr) {}
}
