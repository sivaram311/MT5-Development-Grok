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
import java.util.regex.Matcher;
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

    public Map<String, Object> detectLive(
            List<XauusdCandle> m5,
            List<XauusdCandle> m15,
            List<XauusdCandle> h1,
            List<XauusdCandle> d1) {
        List<Map<String, Object>> setups = scanRecentDays(m5, m15, h1, d1, 1);
        if (setups.isEmpty()) {
            return null;
        }
        Map<String, Object> latest = setups.get(setups.size() - 1);
        latest.put("live", true);
        latest.put("symbol", "XAUUSD");
        return latest;
    }

    public List<Map<String, Object>> scanRecentDays(
            List<XauusdCandle> m5,
            List<XauusdCandle> m15,
            List<XauusdCandle> h1,
            List<XauusdCandle> d1,
            int days) {
        if (m5 == null || m5.size() < 50) {
            return List.of();
        }
        Map<LocalDate, List<XauusdCandle>> byNyDate = m5.stream()
                .filter(c -> c.getNyTime() != null && isInNySession(c.getNyTime()))
                .collect(Collectors.groupingBy(c -> c.getNyTime().toLocalDate()));

        List<LocalDate> dates = byNyDate.keySet().stream()
                .sorted(Comparator.reverseOrder())
                .limit(Math.max(1, days))
                .sorted()
                .collect(Collectors.toList());

        List<Map<String, Object>> all = new ArrayList<>();
        for (LocalDate date : dates) {
            List<XauusdCandle> dayM5 = byNyDate.get(date).stream()
                    .sorted(Comparator.comparing(XauusdCandle::getTime))
                    .collect(Collectors.toList());
            all.addAll(scanDay(dayM5, m5, m15, h1, d1));
        }
        return all;
    }

    private List<Map<String, Object>> scanDay(
            List<XauusdCandle> nyBars,
            List<XauusdCandle> allM5,
            List<XauusdCandle> m15,
            List<XauusdCandle> h1,
            List<XauusdCandle> d1) {

        List<Map<String, Object>> setups = new ArrayList<>();
        if (nyBars.size() < 10) {
            return setups;
        }

        Map<String, Object> session = computeSessionPivots(d1, m15);
        if (session == null) {
            return setups;
        }

        Double pdl = toDoubleObj(session.get("pdl"));
        Double pdh = toDoubleObj(session.get("pdh"));
        LocalDate sessionDate = nyBars.get(0).getNyTime().toLocalDate();

        List<Swing> swingLows = findSwings(allM5, true);
        List<Swing> swingHighs = findSwings(allM5, false);

        double runningLow = toDouble(nyBars.get(0).getLow());
        double runningHigh = toDouble(nyBars.get(0).getHigh());

        for (int i = 0; i < nyBars.size(); i++) {
            XauusdCandle bar = nyBars.get(i);
            int barIdx = indexOfTime(allM5, bar.getTime());
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
                            bar, barIdx, allM5, m15, h1, swingLows, sig, sessionDate);
                    if (setup != null) {
                        setups.add(setup);
                    }
                    break;
                }
            }
            for (Double sig : sigHighs) {
                if (high > sig + SWEEP_BUF) {
                    Map<String, Object> setup = findBearishReturn(
                            bar, barIdx, allM5, m15, h1, swingHighs, sig, sessionDate);
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
            List<XauusdCandle> m5,
            List<XauusdCandle> m15,
            List<XauusdCandle> h1,
            List<Swing> swings,
            double sigLevel,
            LocalDate sessionDate) {

        double sweepLevel = toDouble(sweepBar.getLow());
        LocalDateTime sweepTime = sweepBar.getTime();
        int maxBars = MAX_AFTER_MIN / 5;

        for (int j = sweepIdx + 1; j < Math.min(m5.size(), sweepIdx + 1 + maxBars); j++) {
            XauusdCandle fb = m5.get(j);
            if (ChronoUnit.MINUTES.between(sweepTime, fb.getTime()) > MAX_AFTER_MIN) {
                break;
            }
            double close = toDouble(fb.getClose());
            for (Swing sw : swings) {
                if (sw.index >= sweepIdx) continue;
                if (Math.abs(close - sw.price) <= STRUCT_TOL) {
                    Double h1Rsi = rsiAt(h1, fb.getTime());
                    Double m15Rsi = rsiAt(m15, fb.getTime());
                    if (h1Rsi == null || h1Rsi <= RSI_HTF) continue;
                    if (m15Rsi == null || m15Rsi <= RSI_LTF) continue;
                    if (close <= sweepLevel) continue;

                    double entry = close + 2 * PIP;
                    double sl = sweepLevel - 4 * PIP;
                    double risk = entry - sl;
                    double tp1 = sw.price + risk * 1.5;
                    double tp2 = sw.price + risk * 2.5;
                    Outcome outcome = simulate(m5, j + 1, true, entry, sl, tp1, tp2);

                    return buildSetup(
                            sessionDate, fb, "Bullish", sweepLevel, sw.price,
                            entry, sl, tp1, tp2, outcome, h1Rsi, m15Rsi,
                            "NY Sweep Low + Structure Return + H1/M15 RSI",
                            "Sweep @ " + round2(sweepLevel) + "; structure " + round2(sw.price));
                }
            }
        }
        return null;
    }

    private Map<String, Object> findBearishReturn(
            XauusdCandle sweepBar,
            int sweepIdx,
            List<XauusdCandle> m5,
            List<XauusdCandle> m15,
            List<XauusdCandle> h1,
            List<Swing> swings,
            double sigLevel,
            LocalDate sessionDate) {

        double sweepLevel = toDouble(sweepBar.getHigh());
        LocalDateTime sweepTime = sweepBar.getTime();
        int maxBars = MAX_AFTER_MIN / 5;

        for (int j = sweepIdx + 1; j < Math.min(m5.size(), sweepIdx + 1 + maxBars); j++) {
            XauusdCandle fb = m5.get(j);
            if (ChronoUnit.MINUTES.between(sweepTime, fb.getTime()) > MAX_AFTER_MIN) {
                break;
            }
            double close = toDouble(fb.getClose());
            for (Swing sw : swings) {
                if (sw.index >= sweepIdx) continue;
                if (Math.abs(close - sw.price) <= STRUCT_TOL) {
                    Double h1Rsi = rsiAt(h1, fb.getTime());
                    Double m15Rsi = rsiAt(m15, fb.getTime());
                    if (h1Rsi == null || h1Rsi >= (100 - RSI_HTF)) continue;
                    if (m15Rsi == null || m15Rsi >= (100 - RSI_LTF)) continue;
                    if (close >= sweepLevel) continue;

                    double entry = close - 2 * PIP;
                    double sl = sweepLevel + 4 * PIP;
                    double risk = sl - entry;
                    double tp1 = sw.price - risk * 1.5;
                    double tp2 = sw.price - risk * 2.5;
                    Outcome outcome = simulate(m5, j + 1, false, entry, sl, tp1, tp2);

                    return buildSetup(
                            sessionDate, fb, "Bearish", sweepLevel, sw.price,
                            entry, sl, tp1, tp2, outcome, h1Rsi, m15Rsi,
                            "NY Sweep High + Structure Return + H1/M15 RSI",
                            "Sweep @ " + round2(sweepLevel) + "; structure " + round2(sw.price));
                }
            }
        }
        return null;
    }

    private Map<String, Object> buildSetup(
            LocalDate date, XauusdCandle structBar, String direction,
            double sweepLevel, double structLevel,
            double entry, double sl, double tp1, double tp2,
            Outcome outcome, Double h1Rsi, Double m15Rsi,
            String howSpotted, String notes) {

        String nyTime = structBar.getNyTime() != null
                ? String.format("%02d:%02d", structBar.getNyTime().getHour(), structBar.getNyTime().getMinute())
                : "";
        String istTime = structBar.getIstTime() != null
                ? String.format("%02d:%02d", structBar.getIstTime().getHour(), structBar.getIstTime().getMinute())
                : "";
        String setupId = "XAU_" + date + "_" + nyTime.replace(":", "") + "_" + direction.charAt(0);

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
        setup.put("rsi_htf", h1Rsi != null ? round1(h1Rsi) : null);
        setup.put("rsi_ltf", m15Rsi != null ? round1(m15Rsi) : null);
        setup.put("how_spotted", howSpotted);
        setup.put("notes", notes);
        setup.put("payload", Map.of());
        return setup;
    }

    private Outcome simulate(List<XauusdCandle> m5, int fromIdx, boolean bullish,
                             double entry, double sl, double tp1, double tp2) {
        double risk = Math.abs(entry - sl);
        if (risk <= 0) return new Outcome("Open", null);
        int end = Math.min(m5.size(), fromIdx + 48);
        for (int i = fromIdx; i < end; i++) {
            double high = toDouble(m5.get(i).getHigh());
            double low = toDouble(m5.get(i).getLow());
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
