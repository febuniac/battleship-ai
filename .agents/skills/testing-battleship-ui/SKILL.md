---
name: testing-battleship-ui
description: How to run and manually QA the client-side Battleship SPA (Vite + React + TS) in Chrome — dev server startup, deterministic seeds, known enemy fleet, viewport/reduced-motion emulation and useful DOM assertions.
---

# Manual QA of the Battleship SPA

No backend, no credentials. Everything runs client-side in Vite dev mode.

## Devin Secrets Needed

None.

## Start the app

```bash
source ~/.nvm/nvm.sh && nvm use          # node 22.x is required
cd ~/repos/battleship-ai
setsid nohup npm run dev -- --port 5174 --strictPort > /tmp/vite5174.log 2>&1 &
```

- Vite may bind IPv6/localhost only — open `http://localhost:5174`, not `http://127.0.0.1:5174`.
- Never `pkill -f vite` from the agent shell: it can kill the agent's own shell session.
  Check listeners first (`ss -lptn 'sport = :5174'`) and kill by PID.

## Determinism

`?seed=<n>&aiDelay=<ms>` are supported query params (`aiDelay` paces AI shots).

- Fast play: `http://localhost:5174/?seed=20240617&aiDelay=200`
- To _watch_ the AI turn / input lock: `aiDelay=1500`.
- With `seed=20240617` **and the default (non-randomized) enemy layout**, the enemy fleet has been
  observed at: Carrier B5–F5, Battleship I3–I6, Cruiser H2–J2, Submarine G5–G7, Destroyer H7–I7.
  Firing those 17 cells gives a deterministic human victory (hits keep your turn).
  NOTE: clicking "Randomize fleet" before Start can consume RNG and change the enemy layout —
  if a known cell misses, just play normally.

## Useful assertions from the DOM / console

Cells are real `<button>`s with accessible names like `"B4, hit"`, `"A1, miss"`, `"H2, sunk"`,
`"E6, invalid placement"`, `"A7, your ship"`, `"A1, unknown"`. Ship art is `aria-hidden` inline SVG in
`pointer-events-none` layers, so counting `[aria-label$="sunk"]` / reading names is the reliable
state check. Live-region text (e.g. `Carrier placed at A3, vertical`) appears as the first node in `<main>`.

Layout checks:

```js
JSON.stringify({
  iw: innerWidth,
  sw: document.documentElement.scrollWidth,
  btns: [...document.querySelectorAll('button')]
    .filter((b) => /Rotate|Randomize|Clear|Start game/.test(b.textContent))
    .map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]),
});
```

Expect `scrollWidth === innerWidth` (no horizontal scroll) and placement controls ≥ 44px tall on mobile.

## Viewport + reduced-motion emulation in Chrome

The desktop window maximizes to ~1440x900, which already matches the desktop target. For other sizes use
DevTools device mode instead of resizing the OS window:

1. `F12`, then `Ctrl+Shift+M` to toggle the device toolbar; dock DevTools to the **right** so the emulated
   viewport gets full height; set zoom to 100% (disable auto-adjust) and type exact dimensions
   (390x844 mobile, 820x1180 tablet).
2. Reduced motion: `Ctrl+Shift+P` → "Emulate CSS prefers-reduced-motion: reduce". Verify objectively via
   the Styles pane showing the `@media (prefers-reduced-motion: reduce)` block with
   `animation-duration: 0.01ms !important`, and/or `matchMedia('(prefers-reduced-motion: reduce)').matches`.
   The emulation is dropped when DevTools closes.
3. Boards stack vertically at tablet/mobile widths and sit side by side only at desktop — expected, not a bug.

## Keyboard flow

Each board grid is a single tab stop (roving `tabIndex`). Arrows move one cell, Home/End jump to
column A/J, Enter places or fires, `R` rotates during placement.

## Visual-quality notes worth re-checking after ship-art changes

- Hull sprites are drawn narrower than the cell, so vertical ships can look thin.
- Cruiser (3) vs Submarine (3) silhouettes are hard to distinguish at mobile cell size (~32px).
