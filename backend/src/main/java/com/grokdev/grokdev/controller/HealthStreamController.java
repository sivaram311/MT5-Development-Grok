package com.grokdev.grokdev.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grokdev.grokdev.service.MarketDataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/market/xauusd")
@CrossOrigin
public class HealthStreamController {

    private static final long POLL_INTERVAL_SECONDS = 30;

    private final MarketDataService marketDataService;
    private final ObjectMapper objectMapper;

    @Autowired
    public HealthStreamController(MarketDataService marketDataService, ObjectMapper objectMapper) {
        this.marketDataService = marketDataService;
        this.objectMapper = objectMapper;
    }

    @GetMapping(value = "/health/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamHealth() {
        SseEmitter emitter = new SseEmitter(0L);
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "health-sse");
            t.setDaemon(true);
            return t;
        });

        Runnable push = () -> {
            try {
                Map<String, Object> health = marketDataService.getMarketDataHealth();
                String payload = objectMapper.writeValueAsString(health);
                emitter.send(SseEmitter.event().name("health").data(payload));
            } catch (IOException e) {
                emitter.completeWithError(e);
                scheduler.shutdown();
            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event().name("error").data("{\"message\":\"health check failed\"}"));
                } catch (IOException ignored) {
                    emitter.completeWithError(e);
                }
            }
        };

        scheduler.scheduleAtFixedRate(push, 0, POLL_INTERVAL_SECONDS, TimeUnit.SECONDS);

        emitter.onCompletion(scheduler::shutdown);
        emitter.onTimeout(() -> {
            scheduler.shutdown();
            emitter.complete();
        });
        emitter.onError(ex -> scheduler.shutdown());

        return emitter;
    }
}
