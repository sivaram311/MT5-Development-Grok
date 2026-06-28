package com.grokdev.grokdev.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.grokdev.grokdev.config.HealthStreamScheduler;

@RestController
@RequestMapping("/api/market/xauusd")
@CrossOrigin
public class HealthStreamController {

    private final HealthStreamScheduler healthStreamScheduler;

    @Autowired
    public HealthStreamController(HealthStreamScheduler healthStreamScheduler) {
        this.healthStreamScheduler = healthStreamScheduler;
    }

    @GetMapping(value = "/health/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamHealth() {
        return healthStreamScheduler.register();
    }
}
