# Browser testing prerequisites

StarCi owns the browser-testing instructions; project tests own their scenarios.
Do not commit browser executables, node_modules or browser caches into the skill,
its .dist bundle, or the product. The browser package and installed browser revision
must match. Do not depend on an arbitrary globally installed Playwright executable.

Before FE/UAT work, inspect the project's existing locked Playwright dependency and
reuse its runner. Install dependencies with the project's package manager and lockfile,
then run the local Playwright CLI (for example `npx --no-install playwright install chromium`).
On Linux the corresponding `install --with-deps chromium` may require administrator
permission; do not assume that permission or silently install system packages.

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
