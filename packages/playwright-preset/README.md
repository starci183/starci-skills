# @starci/playwright-preset

The Playwright config of a front-end repository. Install with `starci link` (see [`packages/README.md`](../README.md));
there is no registry publish.

```ts
// playwright.config.ts
import { starciPlaywrightConfig } from "@starci/playwright-preset"

export default starciPlaywrightConfig({
    baseURL: "http://127.0.0.1:5067",
    webServer: { command: "npm run start", url: "http://127.0.0.1:5067", reuseExistingServer: true },
})
```

- **Three Chromium projects, one per ui-screen viewport**: `desktop` 1440x900, `tablet` 768x1024, `mobile` 390x844. Desktop and
  mobile are the layout-tree `DEFAULT_BREAKPOINTS` (`scripts/work/layout-tree.mjs`) that interface.draw shots use; the spec
  fails if they drift. A flow runs once per viewport, so a screen is asserted at every size it was drawn at.
- One worker, no parallelism, no retries, `forbidOnly` in CI, list reporter, light scheme, reduced motion, trace kept on failure.
- Specs are `**/*.e2e-spec.ts` under `./e2e`. e2e is run by hand: no husky, no coverage, and the CI job is `workflow_dispatch` only.
- `baseURL` defaults to `E2E_BASE_URL`, else `http://127.0.0.1:3000`. The suite runs against a local stack or a double
  generated from the contract, never a step that skips for a missing environment.
