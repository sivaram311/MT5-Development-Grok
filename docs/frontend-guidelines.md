# Frontend Guidelines

## Tech
- Angular 18 (Standalone Components)
- Tailwind CSS (via CDN for fast prototyping)
- Reactive forms not used yet (template-driven for simplicity)

## Mobile-First Approach
- Designed for **Realme P2 Pro** (small phone) and **Realme Pad 2** (tablet)
- Bottom navigation visible only on mobile (`md:hidden`)
- Large touch targets (min 44px)
- Responsive grids: 1-col on phone → 2-col on tablet

## Authentication Pattern
- `AuthService`: central place for token + user state
  - `ensureValidSession()` — called on startup and in guards for proactive refresh
  - `isTokenExpiringSoon()` — used by interceptor for pre-request refresh
  - `getTokenExpiration()` — used for live countdown (updates every 10s)
  - `hasRole(role)` — supports role-based UI rendering
- `AuthInterceptor`:
  - Attaches Bearer token
  - Proactively refreshes if token expires in <5 minutes **before** making the request
  - Handles 401 by refreshing transparently
- `AuthGuard`: protects routes (async + supports refresh)
- **Important for timers**: In components like `WelcomeComponent`, always declare interval properties (e.g. `private expirationInterval?: ReturnType<typeof setInterval>;`) at class level to avoid TS2339 errors when assigning `setInterval`. Always clear in `ngOnDestroy`.

## Recommended Improvements
- Switch to reactive forms + strong typing
- Add loading states globally
- Use Angular Signals (Angular 17+)

## Modern UI (Ongoing)

The Welcome page has been evolved into a clean, modern trading dashboard:

- Segmented control tabs (Overview ↔ Data Grid)
- Premium price hero card with refined typography
- Dedicated Health Dashboard with status cards
- Modern data tables with excellent hover and responsive behavior
- Full per-column visibility toggles (Overview + Data Grid) with persistence
- Consistent use of rounded-3xl, subtle shadows, and good visual hierarchy

**Design principles**:
- Always design for Realme P2 Pro + Realme Pad 2 first
- Large, comfortable interactive areas
- Fast information scanning for traders
- Subtle but delightful interactions

Continue building new features with the same modern, user-first mindset.

See welcome.component.ts for implementation. Follow the same patterns for any new trading UI.

Use for charts or Gann analysis. See `api-endpoints.md`.

All UI changes follow mobile/tablet-first (Realme P2 Pro / Pad 2), user-centric design for ease of access and enriched experience. See root CHANGELOG.md for history.
- Environment-based API URL
- Proactive token refresh already implemented in interceptor (checks <5 min expiry before requests)

## State Management
Currently localStorage + component state. Consider NgRx or Signals for complex apps.