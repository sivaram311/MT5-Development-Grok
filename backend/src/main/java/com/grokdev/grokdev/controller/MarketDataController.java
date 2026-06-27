package com.grokdev.grokdev.controller;

import com.grokdev.grokdev.model.market.XauusdCandle;
import com.grokdev.grokdev.service.MarketDataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/market")
@CrossOrigin
public class MarketDataController {

    private final MarketDataService marketDataService;

    @Autowired
    public MarketDataController(MarketDataService marketDataService) {
        this.marketDataService = marketDataService;
    }

    @GetMapping("/xauusd/{timeframe}")
    public ResponseEntity<List<XauusdCandle>> getXauusdData(
            @PathVariable String timeframe,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "500") int limit) {

        // Normalize timeframe
        String tf = timeframe.toUpperCase();
        if (!List.of("D1", "H4", "H1", "M15", "M5", "M1").contains(tf)) {
            return ResponseEntity.badRequest().build();
        }

        List<XauusdCandle> data = marketDataService.getXauusdData(tf, from, to, limit);
        return ResponseEntity.ok(data);
    }

    @GetMapping("/xauusd/{timeframe}/latest")
    public ResponseEntity<List<XauusdCandle>> getLatestXauusd(
            @PathVariable String timeframe,
            @RequestParam(defaultValue = "200") int limit) {

        String tf = timeframe.toUpperCase();
        if (!List.of("D1", "H4", "H1", "M15", "M5", "M1").contains(tf)) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(marketDataService.getLatestXauusdData(tf, limit));
    }

    @GetMapping("/xauusd/{timeframe}/grid")
    public ResponseEntity<List<XauusdCandle>> getGridData(
            @PathVariable String timeframe,
            @RequestParam(defaultValue = "200") int limit,
            @RequestParam(name = "ny_session_only", defaultValue = "false") boolean nySessionOnly) {

        String tf = timeframe.toUpperCase();
        if (!List.of("D1", "H4", "H1", "M15", "M5", "M1").contains(tf)) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(marketDataService.getXauusdGridData(tf, limit, nySessionOnly));
    }

    @GetMapping("/xauusd/sync-status")
    public ResponseEntity<Map<String, Object>> getSyncStatus() {
        return ResponseEntity.ok(marketDataService.getSyncStatus());
    }

    @GetMapping("/xauusd/health")
    public ResponseEntity<Map<String, Object>> getMarketDataHealth() {
        return ResponseEntity.ok(marketDataService.getMarketDataHealth());
    }
}
