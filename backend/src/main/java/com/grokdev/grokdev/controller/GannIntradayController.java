package com.grokdev.grokdev.controller;

import com.grokdev.grokdev.config.GannIntradayStreamScheduler;
import com.grokdev.grokdev.service.GannIntradayService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api/market/xauusd/gann-intraday")
@CrossOrigin
public class GannIntradayController {

    private final GannIntradayService gannIntradayService;
    private final GannIntradayStreamScheduler gannIntradayStreamScheduler;

    @Autowired
    public GannIntradayController(
            GannIntradayService gannIntradayService,
            GannIntradayStreamScheduler gannIntradayStreamScheduler) {
        this.gannIntradayService = gannIntradayService;
        this.gannIntradayStreamScheduler = gannIntradayStreamScheduler;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSnapshot(
            @RequestParam(defaultValue = "M5") String entry_tf,
            @RequestParam(defaultValue = "nyOpen") String so9_pivot,
            @RequestParam(defaultValue = "1.0") double time_scale,
            @RequestParam(defaultValue = "1.25") double atr_threshold,
            @RequestParam(defaultValue = "true") boolean prefer_live) {
        return ResponseEntity.ok(gannIntradayService.getSnapshot(
                entry_tf, so9_pivot, time_scale, atr_threshold, prefer_live));
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return gannIntradayStreamScheduler.register();
    }
}
