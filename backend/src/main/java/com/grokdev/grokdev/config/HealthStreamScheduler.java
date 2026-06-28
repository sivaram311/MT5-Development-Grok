package com.grokdev.grokdev.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grokdev.grokdev.service.HealthSnapshotService;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class HealthStreamScheduler {

    private static final long POLL_INTERVAL_SECONDS = 30;

    private final HealthSnapshotService healthSnapshotService;
    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService scheduler;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public HealthStreamScheduler(HealthSnapshotService healthSnapshotService, ObjectMapper objectMapper) {
        this.healthSnapshotService = healthSnapshotService;
        this.objectMapper = objectMapper;
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "health-sse-shared");
            t.setDaemon(true);
            return t;
        });
        this.scheduler.scheduleAtFixedRate(this::broadcast, 0, POLL_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    public SseEmitter register() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> {
            emitters.remove(emitter);
            emitter.complete();
        });
        emitter.onError(ex -> emitters.remove(emitter));
        return emitter;
    }

    private void broadcast() {
        if (emitters.isEmpty()) {
            return;
        }
        try {
            Map<String, Object> health = healthSnapshotService.getHealthSnapshot();
            String payload = objectMapper.writeValueAsString(health);
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().name("health").data(payload));
                } catch (IOException ex) {
                    emitters.remove(emitter);
                    emitter.completeWithError(ex);
                }
            }
        } catch (Exception ex) {
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().name("error").data("{\"message\":\"health check failed\"}"));
                } catch (IOException ignored) {
                    emitters.remove(emitter);
                }
            }
        }
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdown();
    }
}
