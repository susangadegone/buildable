// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Optional GitHub Pages static build: active ONLY when GH_PAGES_BASE is set (e.g. "/buildable/").
const rawGhPagesBase = process.env.GH_PAGES_BASE;
const ghPagesBase = rawGhPagesBase
  ? `/${rawGhPagesBase.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/")
  : undefined;

export default defineConfig(
  ghPagesBase
    ? {
        vite: { base: ghPagesBase },
        tanstackStart: {
          server: { entry: "server" },
          spa: { enabled: true, prerender: { outputPath: "/index.html" } },
          prerender: { enabled: true, autoStaticPathsDiscovery: false },
          pages: [{ path: "/" }],
        },
      }
    : {
        tanstackStart: {
          // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
          // nitro/vite builds from this
          server: { entry: "server" },
        },
      },
);
