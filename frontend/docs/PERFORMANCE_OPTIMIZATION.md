# Angular Frontend Performance Optimization

**Date:** June 29, 2026  
**Scope:** Dashboard real-time pages (Order RSI, Gann Intraday, Market, Volatility)  
**Goal:** Reduce CPU usage and UI freezing without changing functional behaviour.

---

## Summary of Applied Changes

| Area | Implementation | Files |
|------|----------------|-------|
| Change detection | `ChangeDetectionStrategy.OnPush` on dashboard pages + key UI components | `order-rsi`, `gann-intraday`, `market`, `volatility`, `health`, `analysis`, `dashboard-layout`, `candle-card`, alert banners |
| SSE throttling | UI coalesces rapid SSE pushes | `stream-throttle.config.ts`, `order-rsi-stream.service.ts`, `gann-intraday-stream.service.ts` |
| Centralized SSE lifecycle | Health + Gann always on in dashboard shell; Order RSI only on Analyzer route | `sse-manager.service.ts`, `dashboard-layout.component.ts` |
| Virtual scroll | `trackBy` on row keys, `minBufferPx` / `maxBufferPx` tuning | `market.component.ts`, `volatility.component.ts` |
| Gann recalculation | 250ms debounce on slider-driven REST refresh | `gann-intraday.component.ts` |
| Subscriptions | `takeUntilDestroyed()` for long-lived observables | Dashboard components, `sse-manager.service.ts` |
| Column rendering | Cached `visibleColumns` array (Market) | `market.component.ts` |

Backend SSE push rates are unchanged. Throttling and OnPush only affect how often the browser re-renders.

---

## SSE Throttle Intervals

Configured in [stream-throttle.config.ts](../src/app/services/stream-throttle.config.ts):

- **Order RSI UI:** 800ms (`ORDER_RSI_UI_THROTTLE_MS`)
- **Gann Intraday UI:** 500ms (`GANN_INTRADAY_UI_THROTTLE_MS`)

Both use `throttleTime(..., { leading: true, trailing: true })` so the latest snapshot is always delivered.

Gann **alert banners** still evaluate every SSE event (not throttled) so reversal warnings are not delayed.

---

## SSE Manager (Route-Aware Streams)

[SseManagerService](../src/app/services/sse-manager.service.ts) is started/stopped by `DashboardLayoutComponent`:

| Stream | When active |
|--------|-------------|
| Health | While dashboard shell is mounted |
| Gann Intraday | While dashboard shell is mounted (banner + page) |
| Order RSI | Only on `/dashboard/order-rsi` or `/welcome/order-rsi` |

Individual pages must **not** call `orderRsiStream.start()` / `stop()` — the manager owns that lifecycle.

---

## OnPush Pattern

Components use `ChangeDetectionStrategy.OnPush` and call `ChangeDetectorRef.markForCheck()` after:

- HTTP / cache responses
- SSE snapshot updates
- User-driven state changes (sort, column prefs, loading flags)

Event bindings (`click`, `input`) still trigger checks on the target component automatically.

---

## Virtual Scroll

Market and Volatility grids use CDK virtual scroll with:

```html
<cdk-virtual-scroll-viewport itemSize="40" minBufferPx="200" maxBufferPx="400">
  <div *cdkVirtualFor="let row of rows; trackBy: trackRow">...</div>
</cdk-virtual-scroll-viewport>
```

`trackBy` uses stable candle `time` keys so DOM nodes are recycled efficiently during scroll.

---

## Gann Intraday Debounce

Slider changes (`timeScaleFactor`, `extensionThresholdAtr`) call `refreshDebounced()` (250ms) instead of immediate `refresh()`. Pivot buttons, timeframe changes, and the Refresh button still call `refresh()` immediately.

Live SSE study updates on the Gann page are unchanged (throttled at 500ms for display only).

---

## Profiling (Optional)

1. **Angular DevTools** → Profiler while using Order RSI or Market grid
2. **Chrome Performance** → record during scroll + live SSE
3. Expect fewer change-detection cycles after OnPush + throttling

---

## Future Improvements (Not Implemented)

- Web Worker for heavy Gann math on very low-end devices
- Further pre-computation in Order RSI row templates

These were deferred to keep behaviour identical and diff size manageable.

---

## Related Docs

- [ANGULAR_FRONTEND.md](ANGULAR_FRONTEND.md) — architecture and services
- [MOBILE_TABLET_UX.md](MOBILE_TABLET_UX.md) — layout and touch targets
- [GANN_INTRADAY_USAGE_GUIDE.md](GANN_INTRADAY_USAGE_GUIDE.md) — Gann page usage
