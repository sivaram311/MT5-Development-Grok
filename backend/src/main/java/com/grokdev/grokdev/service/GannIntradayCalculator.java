package com.grokdev.grokdev.service;

import com.grokdev.grokdev.model.market.XauusdCandle;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Server-side Gann intraday study (mirrors frontend/python gann_intraday_util).
 */
@Component
public class GannIntradayCalculator {

    private static final Pattern NY_PARTS = Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})[T ](\\d{2}):(\\d{2})");

    public Map<String, Object> compute(
            String entryTf,
            List<XauusdCandle> entry,
            List<XauusdCandle> m15,
            List<XauusdCandle> d1,
            String so9PivotKey,
            double timeScaleFactor,
            double extensionThresholdAtr) {

        Map<String, Object> session = computeSessionPivots(d1, m15);
        if (session == null || entry == null || entry.isEmpty()) {
            return null;
        }

        Double pivotPrice = sessionPivotPrice(session, so9PivotKey);
        if (pivotPrice == null) {
            pivotPrice = (Double) session.get("nySessionOpen");
        }
        if (pivotPrice == null) {
            pivotPrice = (Double) session.get("prevClose");
        }
        if (pivotPrice == null || pivotPrice <= 0) {
            return null;
        }

        XauusdCandle latest = entry.get(0);
        double currentPrice = toDouble(latest.getClose());
        if (currentPrice <= 0) {
            currentPrice = toDouble(latest.getOpen());
        }

        Map<String, Object> oddEven = gannOddEvenSquares(pivotPrice, so9PivotKey);
        if (oddEven == null) {
            return null;
        }

        List<Map<String, Object>> fineLevels = computeSo9FineLevels(pivotPrice);
        List<Map<String, Object>> fineAbove = new ArrayList<>();
        List<Map<String, Object>> fineBelow = new ArrayList<>();
        for (Map<String, Object> level : fineLevels) {
            double price = (Double) level.get("price");
            if (price > pivotPrice) {
                fineAbove.add(level);
            } else if (price < pivotPrice) {
                fineBelow.add(level);
            }
        }

        int originIdx = findOriginBarIndex(m15, (String) session.get("nySessionStart"));
        Map<String, Object> angle = computeGannOneByOne(
                entry, pivotPrice, pivotLabel(so9PivotKey), originIdx, extensionThresholdAtr);
        if (angle == null) {
            return null;
        }

        Map<String, Object> timeSquare = computeTimeSquare(
                (String) session.get("nySessionStart"),
                (Double) session.get("nySessionOpen"),
                currentPrice,
                timeScaleFactor);

        String nyTime = latest.getNyTime() != null ? latest.getNyTime().toString() : null;
        String istTime = latest.getIstTime() != null ? latest.getIstTime().toString() : null;
        List<Map<String, Object>> killzones = evaluateKillzones(nyTime, istTime);

        List<Double> allLevels = new ArrayList<>();
        addBandLevels(allLevels, oddEven, "oddSquare");
        addBandLevels(allLevels, oddEven, "evenSquare");
        for (Map<String, Object> l : fineLevels) {
            allLevels.add((Double) l.get("price"));
        }
        boolean nearSo9 = isNearAnyLevel(currentPrice, allLevels);
        boolean volumeSpike = detectVolumeSpike(entry);
        String rsiDiv = detectRsiDivergence(entry);
        Map<String, Object> reversal = buildReversalAlert(angle, timeSquare, killzones, nearSo9, entry, volumeSpike, rsiDiv);

        Map<String, Object> study = new LinkedHashMap<>();
        study.put("live", true);
        study.put("symbol", "XAUUSD");
        study.put("entryTf", entryTf);
        study.put("currentPrice", round2(currentPrice));
        study.put("session", session);
        study.put("so9PivotKey", so9PivotKey);
        study.put("so9PivotPrice", round5(pivotPrice));
        study.put("oddEven", oddEven);
        study.put("fineAbove", fineAbove);
        study.put("fineBelow", fineBelow);
        study.put("angle", angle);
        study.put("timeSquare", timeSquare);
        study.put("killzones", killzones);
        study.put("filters", Map.of(
                "volumeSpike", volumeSpike,
                "rsiDivergence", rsiDiv != null ? rsiDiv : ""));
        study.put("reversalAlert", reversal);
        study.put("timeScaleFactor", timeScaleFactor);
        study.put("extensionThresholdAtr", extensionThresholdAtr);
        study.put("source", "computed");
        return study;
    }

    @SuppressWarnings("unchecked")
    private void addBandLevels(List<Double> out, Map<String, Object> oddEven, String key) {
        Map<String, Object> band = (Map<String, Object>) oddEven.get(key);
        if (band == null) {
            return;
        }
        out.addAll((List<Double>) band.get("above"));
        out.addAll((List<Double>) band.get("below"));
    }

    private Map<String, Object> computeSessionPivots(List<XauusdCandle> d1, List<XauusdCandle> m15) {
        if (d1 == null || d1.isEmpty()) {
            return null;
        }
        XauusdCandle prev = d1.size() >= 2 ? d1.get(1) : d1.get(0);
        double pdh = toDouble(prev.getHigh()) > 0 ? toDouble(prev.getHigh()) : toDouble(prev.getClose());
        double pdl = toDouble(prev.getLow()) > 0 ? toDouble(prev.getLow()) : toDouble(prev.getClose());
        double prevClose = toDouble(prev.getClose());
        if (prevClose <= 0) {
            return null;
        }

        Map<String, Object> session = new LinkedHashMap<>();
        session.put("pdh", round2(pdh));
        session.put("pdl", round2(pdl));
        session.put("prevClose", round2(prevClose));
        session.put("prevDayTime", prev.getTime() != null ? prev.getTime().toString() : null);

        if (m15 != null && !m15.isEmpty()) {
            String[] latestParts = parseNyParts(m15.get(0).getNyTime() != null
                    ? m15.get(0).getNyTime().toString()
                    : (m15.get(0).getTime() != null ? m15.get(0).getTime().toString() : null));
            if (latestParts != null) {
                String sessionDate = latestParts[0];
                List<XauusdCandle> nyBars = new ArrayList<>();
                List<XauusdCandle> londonBars = new ArrayList<>();
                for (XauusdCandle c : m15) {
                    String ny = c.getNyTime() != null ? c.getNyTime().toString() : c.getTime().toString();
                    String[] p = parseNyParts(ny);
                    if (p == null || !sessionDate.equals(p[0])) {
                        continue;
                    }
                    int mins = Integer.parseInt(p[1]) * 60 + Integer.parseInt(p[2]);
                    if (mins >= 480 && mins <= 1020) {
                        nyBars.add(c);
                    }
                    if (mins >= 180 && mins < 300) {
                        londonBars.add(c);
                    }
                }
                applySessionRange(session, nyBars, "ny");
                applySessionRange(session, londonBars, "london");
            }
        }
        return session;
    }

    private void applySessionRange(Map<String, Object> session, List<XauusdCandle> bars, String prefix) {
        if (bars.isEmpty()) {
            return;
        }
        List<XauusdCandle> ordered = new ArrayList<>(bars);
        java.util.Collections.reverse(ordered);
        XauusdCandle first = ordered.get(0);
        double open = toDouble(first.getOpen()) > 0 ? toDouble(first.getOpen()) : toDouble(first.getClose());
        session.put(prefix + "SessionOpen", round2(open));
        session.put(prefix + "SessionStart", first.getNyTime() != null ? first.getNyTime().toString() : first.getTime().toString());
        double high = bars.stream().mapToDouble(c -> toDouble(c.getHigh()) > 0 ? toDouble(c.getHigh()) : toDouble(c.getClose())).max().orElse(0);
        double low = bars.stream().mapToDouble(c -> toDouble(c.getLow()) > 0 ? toDouble(c.getLow()) : toDouble(c.getClose())).min().orElse(0);
        session.put(prefix + "SessionHigh", round2(high));
        session.put(prefix + "SessionLow", round2(low));
    }

    private Double sessionPivotPrice(Map<String, Object> session, String key) {
        return switch (key) {
            case "pdh" -> (Double) session.get("pdh");
            case "pdl" -> (Double) session.get("pdl");
            case "prevClose" -> (Double) session.get("prevClose");
            case "nyOpen" -> (Double) session.get("nySessionOpen");
            case "nyHigh" -> (Double) session.get("nySessionHigh");
            case "nyLow" -> (Double) session.get("nySessionLow");
            case "londonOpen" -> (Double) session.get("londonSessionOpen");
            case "londonHigh" -> (Double) session.get("londonSessionHigh");
            case "londonLow" -> (Double) session.get("londonSessionLow");
            default -> null;
        };
    }

    private Map<String, Object> computeGannOneByOne(
            List<XauusdCandle> candles, double pivotPrice, String pivotLabel,
            int originBarIndex, double extensionThresholdAtr) {
        if (candles.isEmpty()) {
            return null;
        }
        double currentPrice = toDouble(candles.get(0).getClose());
        if (currentPrice <= 0) {
            currentPrice = toDouble(candles.get(0).getOpen());
        }
        double atr = computeAtr(candles, 14);
        double slope = atr > 0 ? atr : pivotPrice * 0.0003;
        int bars = Math.max(0, originBarIndex);
        double equilibrium = pivotPrice + bars * slope;
        double deviation = currentPrice - equilibrium;
        double deviationAtr = atr > 0 ? deviation / atr : 0;

        String bias = "balanced";
        if (deviationAtr >= extensionThresholdAtr) {
            bias = "overextended_up";
        } else if (deviationAtr <= -extensionThresholdAtr) {
            bias = "overextended_down";
        }

        List<Map<String, Object>> fanLines = new ArrayList<>();
        for (int n = 0; n < 13; n++) {
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("barsAhead", n);
            line.put("oneByOne", round2(pivotPrice + (bars + n) * slope));
            line.put("twoByOne", round2(pivotPrice + (bars + n) * slope * 2));
            line.put("oneByTwo", round2(pivotPrice + (bars + n) * slope * 0.5));
            fanLines.add(line);
        }

        Map<String, Object> angle = new LinkedHashMap<>();
        angle.put("pivotPrice", round5(pivotPrice));
        angle.put("pivotLabel", pivotLabel);
        angle.put("currentPrice", round2(currentPrice));
        angle.put("equilibriumPrice", round2(equilibrium));
        angle.put("deviation", round2(deviation));
        angle.put("deviationAtr", round2(deviationAtr));
        angle.put("atr", round2(atr));
        angle.put("barsFromOrigin", bars);
        angle.put("oneByOneSlope", round2(slope));
        angle.put("bias", bias);
        angle.put("overextended", !"balanced".equals(bias));
        angle.put("angleAlert", Math.abs(deviationAtr) >= extensionThresholdAtr);
        angle.put("extensionThresholdAtr", extensionThresholdAtr);
        angle.put("fanLines", fanLines);
        return angle;
    }

    private List<Map<String, Object>> computeSo9FineLevels(double pivot) {
        List<Map<String, Object>> levels = new ArrayList<>();
        double sp = Math.sqrt(pivot);
        for (double unit : new double[]{0.25, 0.5, 1.0}) {
            String hint = unit >= 1 ? "180°" : (unit >= 0.5 ? "90°" : "45°");
            for (int n = 1; n <= 3; n++) {
                for (int sign : new int[]{1, -1}) {
                    double root = sp + sign * n * unit;
                    if (root <= 0) {
                        continue;
                    }
                    Map<String, Object> level = new LinkedHashMap<>();
                    level.put("label", (sign > 0 ? "+" : "−") + n + "×" + unit);
                    level.put("price", round2(root * root));
                    level.put("stepUnit", unit);
                    level.put("stepCount", n);
                    level.put("direction", sign > 0 ? "above" : "below");
                    level.put("angleHint", hint);
                    levels.add(level);
                }
            }
        }
        levels.sort((a, b) -> Double.compare((Double) b.get("price"), (Double) a.get("price")));
        return levels;
    }

    private Map<String, Object> gannOddEvenSquares(double pivot, String pivotSource) {
        if (pivot <= 0) {
            return null;
        }
        double sp = Math.sqrt(pivot);
        List<Double> oddAbove = new ArrayList<>();
        List<Double> oddBelow = new ArrayList<>();
        List<Double> evenAbove = new ArrayList<>();
        List<Double> evenBelow = new ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            double step = i * 2.0;
            addSqrtLevel(sp, step, oddAbove);
            addSqrtLevel(sp, -step, oddBelow);
            addSqrtLevel(sp, step + 1, evenAbove);
            addSqrtLevel(sp, -(step + 1), evenBelow);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("available", true);
        result.put("pivot", round5(pivot));
        result.put("sqrtPivot", round5(sp));
        result.put("pivotSource", pivotSource);
        result.put("oddSquare", Map.of("above", oddAbove, "below", oddBelow));
        result.put("evenSquare", Map.of("above", evenAbove, "below", evenBelow));
        return result;
    }

    private void addSqrtLevel(double sp, double offset, List<Double> target) {
        double root = sp + offset;
        if (root > 0) {
            target.add(round5(root * root));
        }
    }

    private Map<String, Object> computeTimeSquare(
            String sessionStart, Double sessionOpen, double currentPrice, double scaleFactor) {
        if (sessionOpen == null || sessionOpen <= 0) {
            return null;
        }
        long minutesElapsed = 0;
        if (sessionStart != null) {
            LocalDateTime start = LocalDateTime.parse(sessionStart.replace(" ", "T"));
            minutesElapsed = Math.max(0, ChronoUnit.MINUTES.between(start, LocalDateTime.now()));
        }
        double priceMove = currentPrice - sessionOpen;
        double absMove = Math.abs(priceMove);
        double ratio = minutesElapsed > 0 ? absMove / minutesElapsed : 0;

        List<Map<String, Object>> milestones = new ArrayList<>();
        for (int minutes : new int[]{45, 90, 180}) {
            double scaled = minutes * scaleFactor;
            double target = sessionOpen + (priceMove >= 0 ? scaled : -scaled);
            boolean nearTime = Math.abs(minutesElapsed - minutes) <= 5;
            boolean nearPrice = Math.abs(currentPrice - target) <= Math.max(2, absMove * 0.05);
            boolean nearEquality = Math.abs(absMove - scaled) <= Math.max(1.5, scaled * 0.08) && nearTime;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("minutes", minutes);
            m.put("label", minutes + " min");
            m.put("scaledMove", round2(scaled));
            m.put("priceTarget", round2(target));
            m.put("nearSquare", nearTime || nearPrice || nearEquality);
            milestones.add(m);
        }

        final long elapsed = minutesElapsed;
        boolean anyNear = milestones.stream().anyMatch(x -> Boolean.TRUE.equals(x.get("nearSquare")))
                || java.util.Arrays.stream(new int[]{45, 90, 180}).anyMatch(m ->
                Math.abs(elapsed - m) <= 3 && Math.abs(absMove - m * scaleFactor) <= 3);

        Map<String, Object> ts = new LinkedHashMap<>();
        ts.put("sessionStart", sessionStart);
        ts.put("minutesElapsed", minutesElapsed);
        ts.put("priceMove", round2(priceMove));
        ts.put("absPriceMove", round2(absMove));
        ts.put("ratioPricePerMin", round2(ratio));
        ts.put("scaleFactor", scaleFactor);
        ts.put("milestones", milestones);
        ts.put("anyNearSquare", anyNear);
        return ts;
    }

    private List<Map<String, Object>> evaluateKillzones(String nyTime, String istTime) {
        Integer mins = parseNyMinutes(nyTime);
        Integer istMins = parseNyMinutes(istTime);
        List<Map<String, Object>> zones = new ArrayList<>();
        zones.add(killzone("london_open", "London Open", "03:00–05:00 NY", "13:30–15:30 IST", mins, 180, 300));
        zones.add(killzone("ny_open", "NY Open", "08:00–10:00 NY", "17:30–19:30 IST", mins, 480, 600));
        zones.add(killzone("ny_overlap", "NY Overlap", "08:00–11:00 NY", "17:30–20:30 IST", mins, 480, 660));
        zones.add(killzone("ny_close", "NY Afternoon", "14:00–17:00 NY", "23:30–02:30 IST", mins, 840, 1020));
        if (istMins != null) {
            for (Map<String, Object> z : zones) {
                z.put("istActive", istWindowActive((String) z.get("istWindow"), istMins));
            }
        }
        return zones;
    }

    private Map<String, Object> killzone(String id, String label, String window, String istWindow, Integer mins, int start, int end) {
        Map<String, Object> z = new LinkedHashMap<>();
        z.put("id", id);
        z.put("label", label);
        z.put("window", window);
        z.put("istWindow", istWindow);
        z.put("active", mins != null && mins >= start && mins < end);
        return z;
    }

    private boolean istWindowActive(String window, int istMins) {
        Matcher m = Pattern.compile("(\\d{2}):(\\d{2})–(\\d{2}):(\\d{2})").matcher(window);
        if (!m.find()) {
            return false;
        }
        int start = Integer.parseInt(m.group(1)) * 60 + Integer.parseInt(m.group(2));
        int end = Integer.parseInt(m.group(3)) * 60 + Integer.parseInt(m.group(4));
        if (end < start) {
            return istMins >= start || istMins <= end;
        }
        return istMins >= start && istMins <= end;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> buildReversalAlert(
            Map<String, Object> angle, Map<String, Object> timeSquare,
            List<Map<String, Object>> killzones, boolean nearSo9,
            List<XauusdCandle> candles, boolean volumeSpike, String rsiDiv) {
        List<String> reasons = new ArrayList<>();
        int score = 0;

        if (Boolean.TRUE.equals(angle.get("angleAlert"))) {
            reasons.add("1×1 alert — stretched (" + angle.get("deviationAtr") + "× ATR)");
            score += 2;
        } else if (Boolean.TRUE.equals(angle.get("overextended"))) {
            reasons.add("1×1 " + angle.get("bias") + " (" + angle.get("deviationAtr") + "× ATR)");
            score += 2;
        }
        if (nearSo9) {
            reasons.add("At Square of Nine level");
            score++;
        }
        if (timeSquare != null && Boolean.TRUE.equals(timeSquare.get("anyNearSquare"))) {
            reasons.add("Time squaring milestone");
            score++;
        }
        if (killzones.stream().anyMatch(z -> Boolean.TRUE.equals(z.get("active")))) {
            reasons.add("Killzone active");
            score++;
        }
        if (detectReversalCandle(candles)) {
            reasons.add("Reversal candle pattern");
            score++;
        }
        if (volumeSpike) {
            reasons.add("Volume spike vs 20-bar avg");
            score++;
        }
        if (rsiDiv != null && !rsiDiv.isEmpty()) {
            reasons.add("RSI " + rsiDiv + " divergence");
            score++;
        }

        String severity = score >= 5 ? "high" : (score >= 3 ? "medium" : (score >= 1 ? "low" : "none"));
        String setup = switch (severity) {
            case "high" -> "A+ mean-reversion confluence — confirm entry & use 1×1 as first target";
            case "medium" -> "Watch for rejection — partial confluence";
            case "low" -> "Early warning — wait for more alignment";
            default -> "No active reversal confluence";
        };

        Map<String, Object> alert = new LinkedHashMap<>();
        alert.put("severity", severity);
        alert.put("active", !"none".equals(severity));
        alert.put("reasons", reasons);
        alert.put("setup", setup);
        return alert;
    }

    private boolean detectReversalCandle(List<XauusdCandle> candles) {
        if (candles.size() < 2) {
            return false;
        }
        XauusdCandle cur = candles.get(0);
        XauusdCandle prev = candles.get(1);
        double o0 = toDouble(cur.getOpen()) > 0 ? toDouble(cur.getOpen()) : toDouble(cur.getClose());
        double c0 = toDouble(cur.getClose());
        double o1 = toDouble(prev.getOpen()) > 0 ? toDouble(prev.getOpen()) : toDouble(prev.getClose());
        double c1 = toDouble(prev.getClose());
        double body0 = Math.abs(c0 - o0);
        double range = toDouble(cur.getHigh()) - toDouble(cur.getLow());
        boolean pin = range > 0 && body0 / range < 0.35;
        boolean bull = c0 > o0 && c1 < o1 && c0 >= o1 && o0 <= c1;
        boolean bear = c0 < o0 && c1 > o1 && c0 <= o1 && o0 >= c1;
        return pin || bull || bear;
    }

    private boolean detectVolumeSpike(List<XauusdCandle> candles) {
        if (candles.size() < 21) {
            return false;
        }
        double sum = 0;
        for (int i = 1; i <= 20; i++) {
            Long v = candles.get(i).getTickVolume();
            sum += v != null ? v : 0;
        }
        double avg = sum / 20.0;
        Long cur = candles.get(0).getTickVolume();
        return avg > 0 && cur != null && cur >= avg * 1.5;
    }

    private String detectRsiDivergence(List<XauusdCandle> candles) {
        if (candles.size() < 5) {
            return null;
        }
        List<Double> highs = new ArrayList<>();
        List<Double> lows = new ArrayList<>();
        List<Double> rsis = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            XauusdCandle c = candles.get(i);
            highs.add(toDouble(c.getHigh()) > 0 ? toDouble(c.getHigh()) : toDouble(c.getClose()));
            lows.add(toDouble(c.getLow()) > 0 ? toDouble(c.getLow()) : toDouble(c.getClose()));
            rsis.add(c.getRsi());
        }
        if (rsis.stream().anyMatch(r -> r == null)) {
            return null;
        }
        double maxHigh = highs.subList(1, 5).stream().mapToDouble(d -> d).max().orElse(0);
        double maxRsi = rsis.subList(1, 5).stream().mapToDouble(r -> r).max().orElse(0);
        if (highs.get(0) > maxHigh && rsis.get(0) < maxRsi) {
            return "bearish";
        }
        double minLow = lows.subList(1, 5).stream().mapToDouble(d -> d).min().orElse(0);
        double minRsi = rsis.subList(1, 5).stream().mapToDouble(r -> r).min().orElse(0);
        if (lows.get(0) < minLow && rsis.get(0) > minRsi) {
            return "bullish";
        }
        return null;
    }

    private double computeAtr(List<XauusdCandle> candles, int period) {
        if (candles.size() < period + 1) {
            return 0;
        }
        List<XauusdCandle> chrono = new ArrayList<>(candles);
        java.util.Collections.reverse(chrono);
        double sum = 0;
        for (int i = chrono.size() - period; i < chrono.size(); i++) {
            XauusdCandle cur = chrono.get(i);
            XauusdCandle prev = chrono.get(i - 1);
            double h = toDouble(cur.getHigh()) > 0 ? toDouble(cur.getHigh()) : toDouble(cur.getClose());
            double l = toDouble(cur.getLow()) > 0 ? toDouble(cur.getLow()) : toDouble(cur.getClose());
            double pc = toDouble(prev.getClose()) > 0 ? toDouble(prev.getClose()) : toDouble(prev.getOpen());
            double tr = Math.max(h - l, Math.max(Math.abs(h - pc), Math.abs(l - pc)));
            sum += tr;
        }
        return sum / period;
    }

    private int findOriginBarIndex(List<XauusdCandle> candles, String sessionStart) {
        if (sessionStart == null || candles == null || candles.isEmpty()) {
            return Math.min(candles != null ? candles.size() - 1 : 0, 12);
        }
        for (int i = 0; i < candles.size(); i++) {
            XauusdCandle c = candles.get(i);
            String t = c.getNyTime() != null ? c.getNyTime().toString() : (c.getTime() != null ? c.getTime().toString() : null);
            if (sessionStart.equals(t)) {
                return i;
            }
        }
        return Math.min(candles.size() - 1, 12);
    }

    private boolean isNearAnyLevel(double price, List<Double> levels) {
        if (levels.isEmpty() || price <= 0) {
            return false;
        }
        double tol = Math.max(price * 0.0008, 0.5);
        for (double level : levels) {
            if (Math.abs(level - price) <= tol) {
                return true;
            }
        }
        return false;
    }

    private String pivotLabel(String key) {
        return switch (key) {
            case "pdh" -> "PDH";
            case "pdl" -> "PDL";
            case "prevClose" -> "Prev close";
            case "nyOpen" -> "NY open";
            case "nyHigh" -> "NY high";
            case "nyLow" -> "NY low";
            case "londonOpen" -> "London open";
            case "londonHigh" -> "London high";
            case "londonLow" -> "London low";
            default -> key;
        };
    }

    private String[] parseNyParts(String nyTime) {
        if (nyTime == null) {
            return null;
        }
        Matcher m = NY_PARTS.matcher(nyTime);
        if (!m.find()) {
            return null;
        }
        return new String[]{m.group(1), m.group(2), m.group(3)};
    }

    private Integer parseNyMinutes(String nyTime) {
        String[] p = parseNyParts(nyTime);
        if (p == null) {
            return null;
        }
        return Integer.parseInt(p[1]) * 60 + Integer.parseInt(p[2]);
    }

    private double toDouble(BigDecimal v) {
        return v != null ? v.doubleValue() : 0;
    }

    private double round2(double n) {
        return BigDecimal.valueOf(n).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private double round5(double n) {
        return BigDecimal.valueOf(n).setScale(5, RoundingMode.HALF_UP).doubleValue();
    }
}
