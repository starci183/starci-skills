Task: set up browser testing prerequisites
# Browser testing prerequisites

StarCi owns the browser-testing instructions; project tests own their scenarios.
Do not commit browser executables, node_modules or browser caches into the skill,
its runtime bundle, or the product. The browser package and installed browser revision
must match. Do not depend on an arbitrary globally installed Playwright executable.

Before FE/UAT work, inspect the project's existing locked Playwright dependency and
reuse its runner. Install dependencies with the project's package manager and lockfile,
then run the app's browser proof through `starci gate run --root <app> --tests <pattern>`.
If the gate reports missing Linux browser prerequisites, provisioning them may require
administrator permission; do not assume that permission or silently install system packages.

If no runner exists, provision one explicitly in the authorized tooling scope with
an exact Playwright version and a lockfile. Record the version and setup command.
Use the default machine browser cache or an explicit PLAYWRIGHT_BROWSERS_PATH that
is the same for installation and execution. Do not delete an existing project runner
until its replacement has been verified.

Preflight must actually launch Chromium, open the intended local test target, capture
a screenshot, record and finalize a short video, and verify the output files exist.
A package-install success or executable path alone does not establish readiness.
This distribution documents setup; it does not claim to ship a preinstalled browser
or an implemented StarCi browser-doctor command.

Project screenshots, videos and useful test results belong under the owning
.starciwork UI/implementation/UAT leaves, following their artifact schemas. Temporary
browser profiles remain local. Never store cookies, tokens or secrets in shared media.
Browser setup is required for browser verification, not for Business/Architecture or
backend-only work. See https://playwright.dev/docs/browsers for platform prerequisites.

## Harness scenarios

The runtime harness browser scenarios are owned by `tests/helpers/harness-browser-uat.mjs`;
its `captureContract` and `assertHarnessCapture` own completeness and unique, nonempty raw media declarations. Native request, injected-fault
and lifecycle evidence is owned by `tests/helpers/browser-telemetry.mjs`. The scenario modules
use the portable raw-file recorder in `tests/helpers/browser-proof-artifacts.mjs`; none depends
on a host scratch path. `ui/fixtures/seed.mjs` and `ui/fixtures/media/` own the private scenario
inputs. Commit these sources and public assets; keep produced captures and receipts in a fresh
external run directory.

A caller imports the scenario owners from its selected clean Source checkout and supplies its
full revision, an explicit external run directory and the actual browser/server inputs:

```js
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scenario = await import(pathToFileURL(path.join(source, 'tests/helpers/harness-browser-uat.mjs')));
const telemetry = await import(pathToFileURL(path.join(source, 'tests/helpers/browser-telemetry.mjs')));
await scenario.capturePhase({ source, sourceSha, dir, browser, origin, privateData,
  report, fixture, products, t, guard });
```

Call `capturePhase` for the read-only host and the fresh private fixture, then
`scenario.assertHarnessCapture(report)` before publishing success. The caller supplies `report.source`
and `report.sourceSha`, the real same-revision guard, the actual finalized fixture/products manifests,
and the selected Source dictionary `t`. It owns cold dependencies, the actual UI build and served
asset checks, exact Source revision checks, private typed seed creation, native UAT slot custody,
server/browser closure and environment restoration. These preparation and custody wrappers may live
outside Source; the scenario modules and their required inputs remain in the checkout.

The focused owner is `tests/ui/harness-browser-uat.spec.mjs`. Its private raw-file/count/path/recorder cases
qualify the module boundary; actual browser qualification separately executes the canonical scenarios
against the built harness, retains native recordings, checks unexpected failures after telemetry
closure and verifies capture bytes. An import, count fixture or syntax check does not establish UAT.
