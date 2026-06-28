package com.grokdev.grokdev.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grokdev.grokdev.service.GannIntradayService;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class GannIntradayStreamScheduler {

    private final GannIntradayService gannIntradayService;
    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService scheduler;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private volatile Instant lastPushedAt;

    public GannIntradayStreamScheduler(
            GannIntradayService gannIntradayService,
            ObjectMapper objectMapper,
            @Value("${grok.gann-intraday.stream-poll-ms:500}") long pollMs) {
        this.gannIntradayService = gannIntradayService;
        this.objectMapper = objectMapper;
        long interval = Math.max(100, pollMs);
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "gann-intraday-sse");
            t.setDaemon(true);
            return t;
        });
        this.scheduler.scheduleAtFixedRate(this::broadcastIfChanged, 0, interval, TimeUnit.MILLISECONDS);
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
        pushSnapshot(emitter);
        return emitter;
    }

    private void broadcastIfChanged() {
        if (emitters.isEmpty()) {
            return;
        }
        Instant updated = gannIntradayService.getSnapshotUpdatedAt();
        if (updated != null && updated.equals(lastPushedAt)) {
            return;
        }
        lastPushedAt = updated;
        for (SseEmitter emitter : emitters) {
            pushSnapshot(emitter);
        }
    }

    private void pushSnapshot(SseEmitter emitter) {
        try {
            Map<String, Object> snapshot = gannIntradayService.getSnapshot("M5", "nyOpen", 1.0, 1.25, true);
            String payload = objectMapper.writeValueAsString(snapshot);
            emitter.send(SseEmitter.event().name("gannIntraday").data(payload));
        } catch (IOException ex) {
            emitters.remove(emitter);
            emitter.completeWithError(ex);
        } catch (Exception ex) {
            try {
                emitter.send(SseEmitter.event().name("error").data("{\"message\":\"gann intraday stream failed\"}"));
            } catch (IOException ignored) {
                emitters.remove(emitter);
            }
        }
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdown();
    }
}
