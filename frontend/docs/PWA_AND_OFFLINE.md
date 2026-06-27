# PWA & Offline Shell

The Grok Dev Angular app is installable as a **Progressive Web App** and caches its **app shell** for faster repeat loads.

## Files

| File | Purpose |
|------|---------|
| [manifest.webmanifest](../src/assets/manifest.webmanifest) | Install metadata, theme, icons |
| [ngsw-config.json](../ngsw-config.json) | Service worker cache rules |
| [main.ts](../src/main.ts) | Registers `ngsw-worker.js` in production builds |
| [src/assets/icons/](../src/assets/icons/) | SVG app icons |

## Service Worker

- Enabled only in **production** builds (`ng build` / `ng serve --configuration=production`)
- Disabled during `ng serve` development (default) so API calls are never intercepted unexpectedly
- Registration: `registerWhenStable:30000` via `provideServiceWorker` in [main.ts](../src/main.ts)

### What is cached

| Resource | Strategy |
|----------|----------|
| `index.html`, JS, CSS bundles | Prefetch on install |
| `/assets/**` (icons, manifest, etc.) | Lazy cache |
| `/api/**` market data | **Not cached** — requires live backend + JWT |

The manifest is linked from [index.html](../src/index.html) as `assets/manifest.webmanifest` so it is served correctly in both `ng serve` (dev) and production builds.

When offline, the installed app opens to the login/shell UI; market grids show empty/error until the network returns.

## Install on Realme / Android Chrome

1. Run production build: `ng build`
2. Serve `dist/grok-dev-frontend` over HTTPS (or localhost for testing)
3. Open the app → browser menu → **Install app** / **Add to Home screen**
4. Launches standalone with dark theme (`theme_color: #09090b`)

## Pull-to-Refresh Haptics

[pull-to-refresh.component.ts](../src/app/ui/pull-to-refresh.component.ts) uses the [Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) via [haptic.util.ts](../src/app/utils/haptic.util.ts):

- Light tap (8ms) when pull crosses the release threshold
- Stronger pulse (18ms) when refresh fires

Works on Android devices that expose `navigator.vibrate` (including many Realme models). Silently no-ops elsewhere.

## Verifying the Service Worker

```powershell
cd frontend
ng build
npx http-server dist/grok-dev-frontend -p 4200
```

Open `http://localhost:4200` → DevTools → **Application** → **Service Workers** → confirm `ngsw-worker.js` is active.

To test install + offline shell: enable **Offline** in DevTools Network tab after first load — the app UI should still render; API calls will fail until back online.
