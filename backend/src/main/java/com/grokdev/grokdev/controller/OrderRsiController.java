package com.grokdev.grokdev.controller;

import com.grokdev.grokdev.config.OrderRsiStreamScheduler;
import com.grokdev.grokdev.service.OrderRsiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api/market/xauusd/order-rsi")
@CrossOrigin
public class OrderRsiController {

    private final OrderRsiService orderRsiService;
    private final OrderRsiStreamScheduler orderRsiStreamScheduler;

    @Autowired
    public OrderRsiController(OrderRsiService orderRsiService, OrderRsiStreamScheduler orderRsiStreamScheduler) {
        this.orderRsiService = orderRsiService;
        this.orderRsiStreamScheduler = orderRsiStreamScheduler;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSnapshot() {
        return ResponseEntity.ok(orderRsiService.getLiveSnapshot());
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return orderRsiStreamScheduler.register();
    }
}
