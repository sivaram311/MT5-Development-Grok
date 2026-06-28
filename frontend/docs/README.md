# Technical Documentation Index

This folder contains deep technical documentation for the entire Grok Dev project (Python Sync, Spring Boot REST API, and Angular Frontend).

All documentation is written with **mobile and tablet reading** in mind.

## Documentation Files

- [TECHNICAL_OVERVIEW.md](file:///E:/Source/grok_dev/frontend/docs/TECHNICAL_OVERVIEW.md) — High-level architecture, three-layer diagrams, and design trade-offs.
- [DATABASE_SCHEMA.md](file:///E:/Source/grok_dev/frontend/docs/DATABASE_SCHEMA.md) — Dynamic Postgres schemas, tables, index columns, and security fields.
- [PYTHON_MT5_DOWNLOADER.md](file:///E:/Source/grok_dev/frontend/docs/PYTHON_MT5_DOWNLOADER.md) — MetaTrader 5 integration, candle completion rules, and daemon sync loops.
- [mt5_scripts/README.md](file:///E:/Source/grok_dev/python/mt5_scripts/README.md) — **MQL5 Expert Advisors** (Order RSI + Gann scanner): install, compile, deploy.
- [SPRINGBOOT_BACKEND.md](file:///E:/Source/grok_dev/frontend/docs/SPRINGBOOT_BACKEND.md) — REST controllers, raw JDBC execution, freshness math, security config, and preference APIs.
- [ANGULAR_FRONTEND.md](file:///E:/Source/grok_dev/frontend/docs/ANGULAR_FRONTEND.md) — Routed layout components, custom table wrappers, timezone formatting safety, and column preferences logic.
- [GANN_INTRADAY_USAGE_GUIDE.md](file:///E:/Source/grok_dev/frontend/docs/GANN_INTRADAY_USAGE_GUIDE.md) — **How to use** the Gann Intraday page (`/dashboard/gann-intraday`): controls, modules, confluence scoring, tutorials, troubleshooting.
- [DATA_FLOW_AND_INTEGRATION.md](file:///E:/Source/grok_dev/frontend/docs/DATA_FLOW_AND_INTEGRATION.md) — End-to-end trace of a candle from MT5 to display, health checks, and API contracts.
- [NY_SESSION_ONLY_FEATURE.md](file:///E:/Source/grok_dev/frontend/docs/NY_SESSION_ONLY_FEATURE.md) — Logic behind filtering hours and generating synthetic daily bars from M15 intervals.
- [TIMEZONE_HANDLING.md](file:///E:/Source/grok_dev/frontend/docs/TIMEZONE_HANDLING.md) — In-depth mapping of broker, New York, and Indian Standard (IST) time offsets.
- [MOBILE_TABLET_UX.md](file:///E:/Source/grok_dev/frontend/docs/MOBILE_TABLET_UX.md) — Realme P2 Pro and Realme Pad 2 layout rules, grids, and touch constraints.
- [PWA_AND_OFFLINE.md](file:///E:/Source/grok_dev/frontend/docs/PWA_AND_OFFLINE.md) — Installable PWA, service worker app-shell cache, pull-to-refresh haptics.
- [UI_IMPLEMENTATION_PLAN.md](file:///E:/Source/grok_dev/frontend/docs/UI_IMPLEMENTATION_PLAN.md) — Completed UI roadmap
- [RELIABILITY_IMPLEMENTATION_PLAN.md](../../docs/RELIABILITY_IMPLEMENTATION_PLAN.md) — Data pipeline + security hardening (Phase 1–2)
- [DESIGN_TOKENS.md](file:///E:/Source/grok_dev/frontend/docs/DESIGN_TOKENS.md) — Shared colors, spacing, breakpoints, typography.

**E2E tests:** Playwright suite in [frontend/e2e/](../e2e/) — `npm run e2e` from the frontend folder.

A condensed, interactive, and mobile-friendly version of this index is embedded directly inside the application interface — see [docs.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/docs.component.ts) and tap the **Docs** route in the navigation menu.

## Guidelines for Updating Docs

1. Maintain accuracy with respect to the latest codebase changes.
2. Keep layout guidelines and mobile/tablet touch constraints in mind.
3. Synchronize updates to the corresponding accordion sections in the in-app [docs.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/docs.component.ts).
4. Avoid placeholders; provide exact properties and actual code mappings where relevant.