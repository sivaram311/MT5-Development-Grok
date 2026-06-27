# Design Tokens — Grok Dev UI

Shared visual language for the Angular dashboard (`src/app/ui/`).

## Colors (Tailwind zinc + emerald)

| Token | Tailwind | Usage |
|-------|----------|--------|
| Background | `bg-zinc-950` | App shell, body |
| Surface | `bg-zinc-900` | Cards, sheets |
| Border | `border-zinc-800` | Card edges, dividers |
| Text primary | `text-zinc-100` | Headings |
| Text muted | `text-zinc-400` | Subtitles, meta |
| Accent | `text-emerald-400` / `bg-emerald-600` | CTAs, active nav, positive |
| Warning | `text-amber-400` | Stale data, overbought RSI |
| Danger | `text-red-400` | Down pipeline, negative change |

CSS variables in [styles.css](../src/styles.css): `--color-bg`, `--color-accent`, etc.

## Spacing & radius

- Card radius: `rounded-3xl` (`--radius-card: 1.5rem`)
- Touch target minimum: `min-h-11` (44px)
- Page padding: `px-4 py-5` mobile · `sm:p-6` tablet+

## Breakpoints

| Name | Min width | Device |
|------|-----------|--------|
| `mobile:` | 360px | Realme P2 Pro |
| `tablet:` | 800px | Realme Pad 2 |
| `sm:` | 640px | Tailwind default |
| `lg:` | 1024px | Desktop |

## Typography

- UI: system-ui stack (see `body` in styles.css)
- OHLC / times: `font-mono` + `tabular-nums`
- Page title: `text-xl sm:text-2xl font-semibold`
- Section label: `text-[10px] uppercase tracking-wider text-zinc-500`

## Components

Import from `src/app/ui/` — see [ANGULAR_FRONTEND.md](./ANGULAR_FRONTEND.md).
