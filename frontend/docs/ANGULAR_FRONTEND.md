# Angular Frontend — Deep Dive (Mobile & Tablet First)

## Tech Stack Inside This Folder
- Angular 18 (standalone components, no NgModules)
- Lazy loaded routes via `loadComponent` in [app.routes.ts](file:///E:/Source/grok_dev/frontend/src/app/app.routes.ts)
- Tailwind CSS via PostCSS build ([tailwind.config.js](file:///E:/Source/grok_dev/frontend/tailwind.config.js), [styles.css](file:///E:/Source/grok_dev/frontend/src/styles.css))
- **@angular/cdk/scrolling** — virtual scroll for large market grids
- Shared UI kit in [src/app/ui/](file:///E:/Source/grok_dev/frontend/src/app/ui/)
- [preferences.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/preferences.service.ts) — backend-synced column layout (PATCH merge)
- [health-stream.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/health-stream.service.ts) — SSE pipeline alerts
- [market-data-cache.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/market-data-cache.service.ts) — `fetchGridWithFallback()` with IndexedDB offline
- HttpClient + RxJS for API communications
- PWA manifest: [manifest.webmanifest](file:///E:/Source/grok_dev/frontend/src/assets/manifest.webmanifest)
- **@angular/service-worker** — production app-shell caching ([PWA_AND_OFFLINE.md](file:///E:/Source/grok_dev/frontend/docs/PWA_AND_OFFLINE.md))
- **Playwright** e2e tests in [e2e/](file:///E:/Source/grok_dev/frontend/e2e/) — login, manifest, auth guard, dashboard nav (`npm run e2e`)
- Reliability plan: [RELIABILITY_IMPLEMENTATION_PLAN.md](../../docs/RELIABILITY_IMPLEMENTATION_PLAN.md)

## Mobile & Tablet Design Principles

Layout system targets **Realme P2 Pro** (360px) and **Realme Pad 2** (800px):

1. **4+1 navigation**: Four bottom tabs + **More** sheet on phone; sidebar at `tablet:` (800px).
2. **44px touch targets**: `min-h-11` on buttons, nav, and sheet rows.
3. **No hover dependency**: `active:` states for touch feedback.
4. **Dual data views**: Card lists on phone; virtual-scrolled flex rows on tablet+.
5. **Bottom sheets**: Filters and column settings — not center modals.
6. **Pull-to-refresh**: Home, Market, Volatility, and Analysis pages.
7. **Safe areas**: CSS env insets in [styles.css](file:///E:/Source/grok_dev/frontend/src/styles.css).

See [MOBILE_TABLET_UX.md](file:///E:/Source/grok_dev/frontend/docs/MOBILE_TABLET_UX.md) for full patterns.

## Shared UI Kit (`src/app/ui/`)

| Component | Purpose |
|-----------|---------|
| `PageHeaderComponent` | Title, subtitle, `[actions]` and `[toolbar]` slots |
| `SegmentControlComponent` | Snap-scroll timeframe pills |
| `BottomSheetComponent` | Mobile filter/settings panels |
| `CandleCardComponent` | OHLC card for list views |
| `StatusBadgeComponent` | UP / FRESH / STALE chips |
| `EmptyStateComponent` | Loading, empty, retry |
| `NavIconComponent` | SVG navigation icons |
| `PullToRefreshComponent` | Touch pull-to-refresh wrapper |
| `OfflineBannerComponent` | Network / API offline banner |
| `PwaUpdateComponent` | New version available prompt |
| `HealthAlertBannerComponent` | Pipeline DEGRADED/DOWN alert from SSE |

Utilities: [time.util.ts](file:///E:/Source/grok_dev/frontend/src/app/utils/time.util.ts), [gann.util.ts](file:///E:/Source/grok_dev/frontend/src/app/utils/gann.util.ts), [haptic.util.ts](file:///E:/Source/grok_dev/frontend/src/app/utils/haptic.util.ts)

## Layout & Routing

[DashboardLayoutComponent](file:///E:/Source/grok_dev/frontend/src/app/dashboard/dashboard-layout.component.ts):

- **Phone**: Compact header + offline/health banners + `.dashboard-main` content + fixed bottom nav + More sheet
- **Tablet+**: Collapsible sidebar, no bottom nav, table-first pages
- Starts [HealthStreamService](file:///E:/Source/grok_dev/frontend/src/app/services/health-stream.service.ts) on init for live pipeline alerts

Child routes under `/dashboard` (canonical) — `/welcome` is an alias. See [app.routes.ts](file:///E:/Source/grok_dev/frontend/src/app/app.routes.ts).

## Key Dashboard Pages

### OverviewComponent (Home)
[overview.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/overview.component.ts)
- Live KPIs: latest D1 close, % change, pipeline status
- Chart.js price chart, pull-to-refresh
- Recent candles — cards on phone, table on tablet+

### MarketComponent (Data Explorer)
[market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts)
- Segment control, cards/table toggle, filter + column bottom sheets
- **Drag-and-drop** column reorder + ↑↓ buttons (mobile-friendly)
- Column presets + TSV copy + CSV export
- **Virtual scroll** for up to 500 rows (CDK)
- **Preferences sync** via GET/PATCH `/api/auth/preferences` (per timeframe, partial merge)
- Pull-to-refresh, tablet split detail pane, IndexedDB offline cache fallback

### VolatilityComponent
[volatility.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/volatility.component.ts)
- Segment control + lookback + NY Session filter
- Virtual-scrolled sortable grid, mobile cards/table toggle
- Per-timeframe preference sync (limit, sort, NY Session)
- Pull-to-refresh + haptics, CSV export

### HealthComponent
[health.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/health.component.ts)
- Expandable TF cards with troubleshooting tips
- Polls `GET /api/market/xauusd/health`; dashboard also subscribes to SSE stream for push alerts

### AnalysisComponent
[analysis.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/analysis.component.ts)
- **RSI storm scanner** — overbought (≥70) / oversold (≤30) on M15, H1, H4
- **Gann study** — swing octave levels + Square-of-9 projections on D1, H4, H1 ([gann.util.ts](file:///E:/Source/grok_dev/frontend/src/app/utils/gann.util.ts))

### LoginComponent
[login.component.ts](file:///E:/Source/grok_dev/frontend/src/app/login/login.component.ts)
- Mobile-first sign-in with emerald accent, icon inputs, show/hide password
- Session-expired message from `?reason=session_expired`
- Demo credentials hint gated by `environment.showDemoHint`

---

## User Preferences

[PreferencesService](file:///E:/Source/grok_dev/frontend/src/app/services/preferences.service.ts) loads the full preferences JSON once on startup, merges updates in memory, and **PATCHes only the changed section** (server deep-merges — avoids overwriting concurrent updates from other pages).

| Method | Endpoint | Behavior |
|--------|----------|----------|
| Load | `GET /api/auth/preferences` | Full JSON blob |
| Save section | `PATCH /api/auth/preferences` | Partial JSON; server merges into stored prefs |

**Grid keys** (market): `time`, `nyTime`, `istTime`, `open`, `high`, `low`, `close`, `rsi`, `tickVolume`

**Legacy mapping**: `broker→time`, `ny→nyTime`, `ist→istTime`, `vol→tickVolume`

**Market UI keys**: `viewMode` (`cards`|`table`), `nySessionOnly` (boolean)

**Volatility keys** (per timeframe): `limit`, `nySessionOnly`, `sortKey`, `sortAsc`, plus `lastTimeframe` at root of `volatility` object

## Safe Time Formatting

Shared in [time.util.ts](file:///E:/Source/grok_dev/frontend/src/app/utils/time.util.ts). Do not use Angular `date` pipe on naive broker timestamps.

## PWA & Offline

Installable PWA with production service worker caching the app shell. Manifest at `src/assets/manifest.webmanifest`. See [PWA_AND_OFFLINE.md](file:///E:/Source/grok_dev/frontend/docs/PWA_AND_OFFLINE.md). Market data still requires a live backend.

## Health Push Notifications (SSE)

The dashboard connects to `GET /api/market/xauusd/health/stream` (Server-Sent Events, 30s interval). Because `EventSource` cannot send `Authorization` headers, the JWT is passed as `?access_token=` (validated by [JwtAuthenticationFilter.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/security/JwtAuthenticationFilter.java)).

When status changes to `DEGRADED` or `DOWN`, [HealthAlertBannerComponent](file:///E:/Source/grok_dev/frontend/src/app/ui/health-alert-banner.component.ts) shows a dismissible banner with haptic feedback.

## E2E Testing

Playwright config: [playwright.config.ts](file:///E:/Source/grok_dev/frontend/playwright.config.ts)

```powershell
cd frontend
npm run e2e          # headless, mobile + tablet viewports
npm run e2e:ui       # interactive UI mode
```

Smoke tests cover login page rendering, manifest 404 regression, auth guard redirect, and form enablement.

## Authentication & Guards
- [auth.guard.ts](file:///E:/Source/grok_dev/frontend/src/app/guards/auth.guard.ts) — dashboard routes
- [auth.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/auth.service.ts) — login, refresh, session
- [auth.interceptor.ts](file:///E:/Source/grok_dev/frontend/src/app/interceptors/auth.interceptor.ts) — bearer token + 401 handling → `/login?reason=session_expired`
