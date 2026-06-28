# Frontend Guidelines

This document details the frontend standards, architecture, and layouts for the Grok Dev project.

## Core Technology Stack
- **Angular 18**: Standalone components, lazy-loaded routes via `loadComponent`.
- **Tailwind CSS**: PostCSS build (`tailwind.config.js`) — no CDN
- **Canonical route**: `/dashboard` (`/welcome` kept as alias)
- **Shared UI kit**: Reusable components in [frontend/src/app/ui/](file:///E:/Source/grok_dev/frontend/src/app/ui/).
- **Forms**: Template-driven forms for login and filter sheets.

## Mobile-First Guidelines

All layouts target **Realme P2 Pro** (phone) and **Realme Pad 2** (tablet):

- **Bottom navigation (phone)**: Four primary tabs + **More** sheet (`tablet:hidden`). See [dashboard-layout.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/dashboard-layout.component.ts).
- **Sidebar (tablet+)**: Collapsible nav at `tablet:` breakpoint (800px).
- **Touch targets**: Minimum `min-h-11` (44px) on buttons, nav items, and sheet rows.
- **Data presentation**: Card lists default on phone; tables on tablet+ with `overflow-x-auto`.
- **Bottom sheets**: Filters and column customization — not center modals.
- **Safe areas**: `.dashboard-main` and `.mobile-bottom-nav` use CSS env insets ([styles.css](file:///E:/Source/grok_dev/frontend/src/styles.css)).

Full UX reference: [MOBILE_TABLET_UX.md](file:///E:/Source/grok_dev/frontend/docs/MOBILE_TABLET_UX.md).

## User Session & Security Architecture

- **[auth.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/auth.service.ts)**: Central class managing user state and authentication.
- **[auth.interceptor.ts](file:///E:/Source/grok_dev/frontend/src/app/interceptors/auth.interceptor.ts)**: Bearer tokens, proactive refresh, 401 handling.
- **[auth.guard.ts](file:///E:/Source/grok_dev/frontend/src/app/guards/auth.guard.ts)**: Protects dashboard routes.
- **Timer cleanup**: Declare intervals as class properties; clean up in `ngOnDestroy()`.

---

## Dashboard Layout & Routing

Shell: [dashboard-layout.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/dashboard-layout.component.ts)

Routes: [app.routes.ts](file:///E:/Source/grok_dev/frontend/src/app/app.routes.ts) — canonical `/dashboard`, alias `/welcome`.

| Child route | Component | Mobile highlight |
|-------------|-----------|------------------|
| `overview` | Home + chart | Bottom nav "Home" |
| `market` | Data explorer (cards + table) | Bottom nav "Market" |
| `volatility` | Volatility grid | Bottom nav "Volatility" |
| `health` | Pipeline freshness | Bottom nav "Health" |
| `analysis` | RSI storm scanner + Gann levels | More sheet |
| `docs` | In-app technical docs | More sheet |

### Shared UI Components

Located in `frontend/src/app/ui/`:

- `PageHeaderComponent` — consistent page title + toolbar slot
- `SegmentControlComponent` — timeframe pills with horizontal snap scroll
- `BottomSheetComponent` — mobile filter/settings panels
- `CandleCardComponent` — OHLC mobile row
- `OfflineBannerComponent`, `PwaUpdateComponent`, `PullToRefreshComponent`, `HealthAlertBannerComponent`

### Services

- [timeframe-context.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/timeframe-context.service.ts) — global active timeframe
- [network-status.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/network-status.service.ts) — offline/API banners
- [market-data-cache.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/market-data-cache.service.ts) — `fetchGridWithFallback()` (HTTP + IndexedDB offline)
- [health-stream.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/health-stream.service.ts) — SSE pipeline health alerts
- [preferences.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/preferences.service.ts) — PATCH partial preference merge

### E2E Testing

Playwright smoke tests in `frontend/e2e/`. Run `npm run e2e` from the frontend folder (starts dev server automatically).

Implementation plan (Phases A–D + optional follow-ups): [UI_IMPLEMENTATION_PLAN.md](file:///E:/Source/grok_dev/frontend/docs/UI_IMPLEMENTATION_PLAN.md)

For API schema information, see [api-endpoints.md](file:///E:/Source/grok_dev/docs/api-endpoints.md).
