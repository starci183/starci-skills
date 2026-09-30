# e2e shape

Law module: `e2e-shape.mjs`. Catalogue: R66 FE_E2E_SHAPE.

These rules govern `e2e/**` and `playwright.config.*`, not `src/`; `starciFeConfig` attaches them through its second block. Specs are `e2e/<area>/<name>.e2e-spec.ts`; the Playwright projects cover 1440x900, 768x1024 and 390x844; no absolute path, no docker, no write outside the repository, no `test.skip`, and typed helpers.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/e2e-spec-location`

An e2e spec is `e2e/<area>/<name>.e2e-spec.ts`; helpers live under `support/` or `fixtures/`.

**Invalid** (`e2e/play.spec.ts`)

```ts
// file: e2e/play.spec.ts
```

**Valid** (`e2e/course/play.e2e-spec.ts`)

```ts
// file: e2e/course/play.e2e-spec.ts
```

**Finding code:** `FE_E2E_SHAPE`

**Why:** The e2e spec `<file>` is not at `e2e/<area>/<name>.e2e-spec.ts`.

**Fix:** Move the spec into `e2e/<area>/` with the `.e2e-spec.ts` suffix; helpers go into `e2e/support/` or `e2e/fixtures/`.

## `starci-fe/e2e-no-absolute-path`

No absolute filesystem path in e2e source.

**Invalid** (`e2e/support/session.ts`)

```ts
const p = "D:/repos/nivo-backend/out"
```

**Valid** (`e2e/support/session.ts`)

```ts
const p = path.join(__dirname, "fixtures", "a.png")
```

**Finding code:** `FE_E2E_SHAPE`

**Why:** The e2e spec `<file>` uses an absolute path.

**Fix:** Build the path from configuration or from the spec's own directory.

## `starci-fe/e2e-no-docker`

An e2e suite does not start or require Docker.

**Invalid** (`e2e/support/stack.ts`)

```ts
execSync("docker compose up -d")
```

**Valid** (`e2e/course/play.e2e-spec.ts`)

```ts
await page.goto(baseUrl)
```

**Finding code:** `FE_E2E_SHAPE`

**Why:** The e2e spec `<file>` depends on docker.

**Fix:** Point the suite at a URL from configuration; the environment supplies its own stack.

## `starci-fe/e2e-no-cross-repo-write`

An e2e file write never targets an absolute path or climbs out of the repository.

**Invalid** (`e2e/support/seed.ts`)

```ts
await fs.writeFile("../backend/seed.json", data)
```

**Valid** (`e2e/support/seed.ts`)

```ts
await fs.writeFile(path.join(outDir, "report.json"), data)
```

**Finding code:** `FE_E2E_SHAPE`

**Why:** The e2e spec `<file>` writes outside the app's repo (an absolute path or `..`).

**Fix:** Write only into this repo's own results directory.

## `starci-fe/e2e-no-skip`

No `test.skip`, `test.fixme` or `describe.skip`: a missing environment fails the run.

**Invalid** (`e2e/course/play.e2e-spec.ts`)

```ts
test.skip(!process.env.BASE_URL, "needs env")
```

**Valid** (`e2e/course/play.e2e-spec.ts`)

```ts
test("plays", async ({ page }) => {})
```

**Finding code:** `FE_E2E_SHAPE`

**Why:** The e2e spec `<file>` skips tests (`test.skip`/`fixme`) - a missing environment must turn the suite red, not green.

**Fix:** Fix the environment or delete the test; do not skip conditionally.

## `starci-fe/e2e-typed-helpers`

e2e helper parameters are typed and nothing is `any`.

**Invalid** (`e2e/support/session.ts`)

```ts
export const login = async (page, role) => page
```

**Valid** (`e2e/support/session.ts`)

```ts
export const login = async (page: Page, role: Role) => page
```

**Finding code:** `FE_E2E_SHAPE`

**Why:** The e2e helper at `<file>` has an untyped parameter or uses `any`.

**Fix:** Declare a type for every helper parameter; replace `any` with a real type or `unknown` plus a check.

## `starci-fe/playwright-viewports`

playwright.config declares the viewports 1440x900, 768x1024, 390x844 and no others.

**Invalid** (`playwright.config.ts`)

```ts
projects: [{ use: { viewport: { width: 1440, height: 900 } } }]
```

**Valid** (`playwright.config.ts`)

```ts
projects: three, each with one of 1440x900, 768x1024, 390x844
```

**Finding code:** `FE_E2E_SHAPE`

**Why:** `playwright.config` does not declare exactly the three viewports 1440x900, 768x1024, 390x844.

**Fix:** Each project declares one viewport; all three, and no fourth size.
