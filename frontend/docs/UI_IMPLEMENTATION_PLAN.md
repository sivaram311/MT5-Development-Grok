# UI Implementation Plan — Grok Dev Angular Frontend

Mobile-first completion roadmap for Realme P2 Pro (360px) and Realme Pad 2 (800px).

**Status: implemented** (2026-06-28)

---

## Phase A — Foundation & cleanup

| ID | Task | Status |
|----|------|--------|
| A1 | Route `/dashboard` canonical; `/welcome` alias | [x] |
| A2 | Retire legacy `welcome.component.ts` | [x] |
| A3 | Tailwind PostCSS build (no CDN) | [x] |
| A4 | Environment `showDemoHint` + prod apiUrl | [x] |
| A5 | `OfflineBannerComponent` + `NetworkStatusService` | [x] |
| A6 | Auth interceptor → 401 redirect + banner | [x] |
| A7 | Hide demo credentials in production | [x] |

---

## Phase B — Mobile UX completion

| ID | Task | Status |
|----|------|--------|
| B1 | `TimeframeContextService` global TF | [x] |
| B2 | Overview Chart.js mini chart | [x] |
| B3 | Health stale-card actions | [x] |
| B4 | Volatility mobile card view | [x] |
| B5 | Landscape compact bottom nav | [x] |
| B6 | ARIA on nav + alert banners | [x] |
| B7 | Login show-password toggle | [x] |

---

## Phase C — Advanced features

| ID | Task | Status |
|----|------|--------|
| C1 | Analysis RSI storm scanner | [x] |
| C2 | Market tablet split detail pane | [x] |
| C3 | IndexedDB grid cache + offline read | [x] |
| C4 | PWA update prompt component | [x] |
| C5 | `MarketDataCacheService` dedupe | [x] |

---

## Phase D — Quality & docs

| ID | Task | Status |
|----|------|--------|
| D1 | Unit tests: preferences, formatWallTime | [x] |
| D2 | Design tokens doc | [x] |
| D3 | Docs index + plan updated | [x] |
| D4 | README / guidelines synced | [x] |

---

## Key files

- Plan: this file
- Tokens: [DESIGN_TOKENS.md](./DESIGN_TOKENS.md)
- PWA: [PWA_AND_OFFLINE.md](./PWA_AND_OFFLINE.md)
- Mobile UX: [MOBILE_TABLET_UX.md](./MOBILE_TABLET_UX.md)

---

## Future (optional)

All items below were implemented on 2026-06-28:

| Task | Status |
|------|--------|
| Playwright e2e suite (`npm run e2e`) | [x] |
| Backend PATCH preferences (deep merge) | [x] |
| Gann module in Analysis Lab | [x] |
| SSE health push notifications | [x] |

See [ANGULAR_FRONTEND.md](./ANGULAR_FRONTEND.md) and [SPRINGBOOT_BACKEND.md](./SPRINGBOOT_BACKEND.md) for details.
