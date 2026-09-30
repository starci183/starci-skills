# @starci/vitest-preset

The vitest configs of a Next front end: one lane per app or package, one root config. Install it from the npm registry at the exact version in [`knowledge/hfs/canon-pins.yaml`](../../knowledge/hfs/canon-pins.yaml) (see [`packages/README.md`](../README.md)). The preset imports nothing but `node:path`, so the repository passes its own plugins.

```ts
// apps/app/vitest.config.ts
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"
import { defineConfig } from "vitest/config"
import { starciVitestProject } from "@starci/vitest-preset"

export default defineConfig(
    starciVitestProject({
        name: "@nivo/app",
        root: import.meta.dirname,
        alias: { "@": resolve(import.meta.dirname, "src") },
        setupFiles: ["../../vitest.setup.ts"],
        plugins: [react()],
    }),
)
```

```ts
// vitest.config.ts (repository root)
import { defineConfig } from "vitest/config"
import { starciVitestWorkspace } from "@starci/vitest-preset"

export default defineConfig(starciVitestWorkspace({ rootDir: import.meta.dirname }))
```

- A lane is `jsdom`, `globals: true`, `src/**/*.spec.{ts,tsx}`, with `react`, `react-dom`, `@heroui/react` and
  `@heroui/styles` deduped and `next-intl` and `@starci/grammar` inlined.
- The root runs every `apps/*` and `packages/*` lane as a project, so one run writes one `coverage/lcov.info` (v8, plus a
  text and JSON summary). Coverage includes `apps/*/src` and `packages/*/src` and excludes specs, `.next`, `node_modules`,
  `coverage`, `src/messages`, `*.d.ts` and e2e specs: the set Sonar counts. `sonarExclusions()` and `sonarCoverageExclusions()`
  render the `sonar-project.properties` values from the same lists. Thresholds belong to Codecov, not the preset.
