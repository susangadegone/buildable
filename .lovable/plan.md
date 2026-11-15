# Optional GitHub Pages static build

## What I checked
- There are no server functions, server routes or route loaders. The app has two routes (`/` and the root shell), and neither has a loader.
- Both data.sf.gov requests in `src/lib/live-freshness.ts` start inside a `useEffect` in `src/hooks/use-live-freshness.ts`, so they only run in the browser. There's nothing to stop for.
- `@lovable.dev/vite-tanstack-config` is 2.27.2, which is new enough for prerendering (it needs 2.20.0 or later).

## Changes (only `vite.config.ts`, `src/router.tsx` and `package.json`)

1. **vite.config.ts**: read `process.env.GH_PAGES_BASE` when the config loads.
   - **Not set:** the config is exactly what it is now.
   - **Set:**
     - add `vite: { base: GH_PAGES_BASE }`
     - add `tanstackStart.spa: { enabled: true, prerender: { outputPath: "/index.html" } }`
     - add `prerender: { enabled: true, autoStaticPathsDiscovery: false }`
     - add `pages: [{ path: "/" }]`
   - A trailing slash is added to the base if it's missing.
2. **src/router.tsx**: pass `basepath` only when the base Vite set (`import.meta.env.BASE_URL`) isn't `/`. The normal build always has `/`, so nothing changes there.
3. **package.json**: add a `build:gh-pages` script that runs `vite build` and copies `dist/client/index.html` to `dist/client/404.html`. GitHub Pages serves `404.html` for any unknown path, so refreshing a deep link still loads the app.
4. **AGENTS.md**: add one rule saying the GitHub Pages mode is controlled only by `GH_PAGES_BASE`.

Nothing changes in `src/lib`, `src/data`, styles or components.

## Checking it
- Run `GH_PAGES_BASE=/buildable/ bun run build:gh-pages`. Confirm that `dist/client/index.html` exists and that its asset links start with `/buildable/`.
- Serve `dist/client` under `/buildable/` with no server code. Confirm that search works and the DataSF checks appear in the browser's network log.
- Run a normal build without the variable and diff it against the current output. Run the existing tests.

## Output
The static files go to **`dist/client`**; publish that folder to GitHub Pages. The build also writes a server bundle to another folder, which Pages doesn't need. I'll reply with the full diff once this is built.
