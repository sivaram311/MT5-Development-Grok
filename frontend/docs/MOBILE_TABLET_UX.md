# Mobile & Tablet UX Guidelines & Implementation

This application places **Realme P2 Pro** (phone, 360px) and **Realme Pad 2** (tablet, 800px) at the forefront of every UI decision.

## Core Design Rules

- **Thumb accessibility**: Primary navigation and frequent actions sit in bottom reach zones on phones.
- **No hover dependencies**: Use `active:` states; all interactions work on touch.
- **44px minimum touch targets**: Buttons, nav items, and checkbox rows use `min-h-11` (2.75rem).
- **Flexible widths**: Layouts remain readable down to 320px viewport width.
- **Progressive disclosure**: Filters, column customization, and secondary routes use **bottom sheets** — not blocking center modals.
- **Dual data views**: Market and Overview use **card lists on phone**, **tables on tablet+**.
- **Safe areas**: Bottom nav and main content respect `env(safe-area-inset-*)` for notched devices.

---

## Breakpoints

Configured in [index.html](file:///E:/Source/grok_dev/frontend/src/index.html):

| Token | Min width | Target device |
|-------|-----------|---------------|
| default | 0 | Small phones |
| `mobile:` | 360px | Realme P2 Pro |
| `tablet:` | 800px | Realme Pad 2 |
| `lg:` | 1024px | Desktop |

Use `tablet:` (not generic `md:`) for sidebar visibility and table-first layouts.

---

## Shared UI Kit (`src/app/ui/`)

Reusable standalone components enforce consistent mobile patterns:

| Component | File | Purpose |
|-----------|------|---------|
| `PageHeaderComponent` | [page-header.component.ts](file:///E:/Source/grok_dev/frontend/src/app/ui/page-header.component.ts) | Title, subtitle, action + toolbar slots |
| `SegmentControlComponent` | [segment-control.component.ts](file:///E:/Source/grok_dev/frontend/src/app/ui/segment-control.component.ts) | Horizontal snap timeframe pills |
| `BottomSheetComponent` | [bottom-sheet.component.ts](file:///E:/Source/grok_dev/frontend/src/app/ui/bottom-sheet.component.ts) | Native-style filter/settings sheets |
| `CandleCardComponent` | [candle-card.component.ts](file:///E:/Source/grok_dev/frontend/src/app/ui/candle-card.component.ts) | OHLC card for mobile lists |
| `StatusBadgeComponent` | [status-badge.component.ts](file:///E:/Source/grok_dev/frontend/src/app/ui/status-badge.component.ts) | UP/FRESH/STALE chips |
| `EmptyStateComponent` | [empty-state.component.ts](file:///E:/Source/grok_dev/frontend/src/app/ui/empty-state.component.ts) | Loading + empty + retry |
| `NavIconComponent` | [nav-icon.component.ts](file:///E:/Source/grok_dev/frontend/src/app/ui/nav-icon.component.ts) | SVG nav icons (no emoji) |
| `PullToRefreshComponent` | [pull-to-refresh.component.ts](file:///E:/Source/grok_dev/frontend/src/app/ui/pull-to-refresh.component.ts) | Touch pull-to-refresh on Home & Market |

Utilities: [time.util.ts](file:///E:/Source/grok_dev/frontend/src/app/utils/time.util.ts) — safe wall-time formatting.

Services: [preferences.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/preferences.service.ts) — grid column order/visibility + market UI synced via `/api/auth/preferences`.

---

## Navigation Shell

[dashboard-layout.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/dashboard-layout.component.ts):

### Phone (`< tablet`)
- **4 primary bottom tabs**: Home, Market, Volatility, Health
- **More sheet**: Analysis, Docs, Logout
- SVG icons + `routerLinkActive` emerald highlight
- Main content uses `.dashboard-main` bottom padding so content is not hidden behind the nav
- No broken hamburger — sidebar is tablet-only

### Tablet (`tablet:` and up)
- Collapsible left sidebar with full route list (including Docs, Analysis)
- No bottom nav
- Wider content area with table-first data views

---

## Page Patterns

### Home / Overview
[overview.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/overview.component.ts)
- Live KPI strip: latest close, % change, pipeline status
- Quick link chips to Market, Health, Volatility
- Cards on phone, table on tablet+
- **Pull-to-refresh**

### Market Data
[market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts)
- Sticky timeframe segment control
- **Cards / Table toggle** on phone (table default on tablet)
- **Filters sheet**: NY Session, columns, TSV copy, CSV export, refresh
- **Columns sheet**: drag-and-drop reorder, ↑↓ buttons, preset chips
- **Backend preference sync** per timeframe via [preferences.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/preferences.service.ts)
- **CDK virtual scroll** (`@angular/cdk/scrolling`) for 500-row card lists and table rows
- **Pull-to-refresh** on phone (pull down at top of page)

### Volatility
[volatility.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/volatility.component.ts)
- Segment control + lookback + NY Session filter
- **CDK virtual scroll** for large result sets
- **Sortable columns** (touch-friendly header buttons, min-h-11)
- **Preference sync** per timeframe: limit, NY Session, sort key/direction
- **Pull-to-refresh** with haptic feedback
- CSV export

### Health
[health.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/health.component.ts)
- Summary status bar + 2-col grid on phone, 3-col on tablet, 6-col on desktop
- Tap a card to expand inline troubleshooting tip

### Docs
[docs.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/docs.component.ts)
- Accordion sections with `.doc-section` scroll-margin for sticky header
- Touch-friendly nav chips (`min-h-9`)

---

## PWA (Add to Home Screen)

- Web manifest: [manifest.webmanifest](file:///E:/Source/grok_dev/frontend/src/assets/manifest.webmanifest) (served as `/assets/manifest.webmanifest`)
- **Service worker** (production only): [ngsw-config.json](file:///E:/Source/grok_dev/frontend/ngsw-config.json) — caches app shell + assets
- Deep guide: [PWA_AND_OFFLINE.md](file:///E:/Source/grok_dev/frontend/docs/PWA_AND_OFFLINE.md)
- Icons: [src/assets/icons/](file:///E:/Source/grok_dev/frontend/src/assets/icons/)
- On Realme / Chrome Android: **Menu → Install app**

**Offline behaviour:** UI shell loads offline; live XAUUSD data requires network + backend.

## Pull-to-Refresh Haptics

Home, Market, and Volatility use [pull-to-refresh.component.ts](file:///E:/Source/grok_dev/frontend/src/app/ui/pull-to-refresh.component.ts) with [haptic.util.ts](file:///E:/Source/grok_dev/frontend/src/app/utils/haptic.util.ts) — light vibration on threshold cross and on refresh (Android / supported devices).

---

## User Preferences API

Grid layout and market UI persist per user:

| Endpoint | Method | Body |
|----------|--------|------|
| `/api/auth/preferences` | GET | Returns `{ "preferences": "<JSON string>" }` |
| `/api/auth/preferences` | PUT | `{ "preferences": "<JSON string>" }` — full replace |
| `/api/auth/preferences` | PATCH | `{ "preferences": "<partial JSON>" }` — deep merge (preferred) |

JSON shape (partial):

```json
{
  "grid": {
    "D1": {
      "visibility": { "time": true, "nyTime": true, "rsi": true, "tickVolume": false },
      "order": ["time", "nyTime", "istTime", "open", "high", "low", "close", "rsi"]
    }
  },
  "market": {
    "viewMode": "cards",
    "nySessionOnly": false
  },
  "volatility": {
    "D1": {
      "limit": 90,
      "nySessionOnly": false,
      "sortKey": "diff",
      "sortAsc": false
    },
    "lastTimeframe": "D1"
  }
}
```

Legacy keys (`broker`, `ny`, `ist`, `vol`) are mapped automatically on load via `PreferencesService`.

---

## Health Push Alerts

When signed in, the dashboard shell subscribes to `GET /api/market/xauusd/health/stream` (SSE). If pipeline status changes to **DEGRADED** or **DOWN**, a dismissible banner appears below the offline banner with a link to the Health page. Haptic feedback fires on supported Android devices.

---

## Analysis Lab

[analysis.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/analysis.component.ts)

- **RSI** tab — storm scanner (≥70 / ≤30) on M15, H1, H4
- **Gann** tab — swing octave levels + Square-of-9 from recent range on D1, H4, H1

---

## Testing Checklist

1. Chrome DevTools → **360×800** (Realme P2 Pro portrait)
2. Verify bottom nav does not overlap content when scrolling Market cards
3. Open **Filters** sheet — NY Session checkbox is easy to tap
4. Toggle **Cards ↔ Table** on Market
5. **800×1280** (Pad 2) — sidebar visible, no bottom nav, table view default
6. Landscape phone — segment control scrolls horizontally
7. Confirm `viewport-fit=cover` — no content under system gesture bar
8. **Market → Columns** — drag reorder or use ↑↓; verify "Preferences saved" hint
9. **Pull down** on Home or Market at scroll top — data refreshes
10. Install PWA from browser menu — app opens standalone with dark theme
11. **Analysis → Gann** — levels render from D1 grid data
12. **`npm run e2e`** — Playwright smoke tests pass (login, manifest, auth guard)

---

## Future Enhancements

- Optional API response cache for read-only health endpoint when offline
- Column visibility presets on Volatility (if column count grows)
- Full authenticated e2e flow (login → dashboard with mock backend)
