package com.grokdev.grokdev.controller;

import com.grokdev.grokdev.config.NyLiquiditySweepStreamScheduler;
import com.grokdev.grokdev.service.NyLiquiditySweepService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/market/xauusd/ny-liquidity-sweep")
@CrossOrigin
public class NyLiquiditySweepController {

    private final NyLiquiditySweepService service;
    private final NyLiquiditySweepStreamScheduler streamScheduler;

    @Autowired
    public NyLiquiditySweepController(
            NyLiquiditySweepService service,
            NyLiquiditySweepStreamScheduler streamScheduler) {
        this.service = service;
        this.streamScheduler = streamScheduler;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getLiveSnapshot(
            @RequestParam(defaultValue = "true") boolean prefer_live) {
        return ResponseEntity.ok(service.getLiveSnapshot(prefer_live));
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return streamScheduler.register();
    }

    @GetMapping("/setups")
    public ResponseEntity<List<Map<String, Object>>> getSetups(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String direction,
            @RequestParam(required = false) String result,
            @RequestParam(defaultValue = "500") int limit) {
        return ResponseEntity.ok(service.getHistoricalSetups(from, to, direction, result, limit));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(service.getStats());
    }

    @GetMapping("/chart/{setupId}")
    public ResponseEntity<Map<String, Object>> getChart(@PathVariable String setupId) {
        return ResponseEntity.ok(service.getChartData(setupId));
    }

    @PostMapping("/scan")
    public ResponseEntity<Map<String, Object>> scan(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(service.scanFromGrid(days));
    }
}
