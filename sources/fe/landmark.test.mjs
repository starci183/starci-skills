/**
 * Twin tests for the landmark rules.
 *
 *   node --test landmark.test.mjs
 *
 * The cases that decide whether these rules are honest are the EXEMPTIONS, not the violations. A
 * first version fired on every layout that rendered `children`, which caught the root document
 * shell and every pass-through layout - and satisfying it there would have put a second `main` in
 * the document, which the companion rule refuses. So the exemptions are tested first: a rule with
 * no correct way to satisfy it is worse than no rule.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { isPageTierFile, isRouteFile, rules } from "./landmark.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const ROOT_LAYOUT = "D:/repo/src/app/layout.tsx"
const NESTED_LAYOUT = "D:/repo/src/app/dashboard/layout.tsx"
const PAGE = "D:/repo/src/components/pages/DashboardPage/component.tsx"
const BRANCH = "D:/repo/src/components/branches/Main/index.tsx"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.equal(typeof rule.create, "function", `${name} publishes no create()`)
    assert.ok(rule.meta?.messages, `${name} publishes no messages`)
  }
})

tester.run("routed-page-is-a-main-landmark", rules["routed-page-is-a-main-landmark"], {
  valid: [
    {
      // The chrome-composing layout marks the page. This is the shape the law asks for.
      filename: NESTED_LAYOUT,
      code: `const L = ({ children }) => <Tree contract="nav-over-body-page" render={{ body: () => <Main contract="routed-page-main" render={() => children} /> }} />
export default L`,
    },
    {
      // The ROOT layout renders children and composes no chrome: it draws html/body and mounts
      // providers. Marking here would claim the landmark above the layout that owns the navigation.
      filename: ROOT_LAYOUT,
      code: `const L = ({ children }) => <html><body><AppProviders>{children}</AppProviders></body></html>
export default L`,
    },
    {
      // A PASS-THROUGH layout delegates its chrome, so it marks nothing.
      filename: NESTED_LAYOUT,
      code: `const L = ({ children }) => <PublicProfileLayout content={children} />
export default L`,
    },
    {
      // Not a route layout at all.
      filename: PAGE,
      code: "const P = ({ children }) => <Tree contract=\"x\" render={() => children} />\nexport default P",
    },
  ],
  invalid: [
    {
      // Composes its own chrome around the routed page and leaves it a div.
      filename: NESTED_LAYOUT,
      code: `const L = ({ children }) => <Tree contract="nav-over-body-page" render={{ body: () => children }} />
export default L`,
      errors: [{ messageId: "missing" }],
    },
  ],
})

const ROUTE_PAGE = "D:/repo/src/app/dashboard/page.tsx"

tester.run("main-landmark-belongs-to-a-route-file", rules["main-landmark-belongs-to-a-route-file"], {
  valid: [
    {
      filename: NESTED_LAYOUT,
      code: "const L = ({ children }) => <Main contract=\"routed-page-main\" render={() => children} />\nexport default L",
    },
    {
      // A route with no chrome-composing layout has its PAGE as the outermost composer, and one
      // landmark in it is correct. An earlier version refused exactly this and was wrong: the
      // alternative it demanded was a layout invented only to wrap.
      filename: ROUTE_PAGE,
      code: "const P = () => <Main contract=\"centred-viewport-main\" render={() => null} />\nexport default P",
    },
    {
      // The branch's own implementation is the one file that opens the element.
      filename: BRANCH,
      code: "export const Main = ({ contract, render }) => <main data-component=\"Main\">{render}</main>",
    },
  ],
  invalid: [
    {
      // The trap this law was written for: a reading column drawn as a second landmark.
      filename: PAGE,
      code: "export const P = () => <Main contract=\"dashboard-main\" render={() => null} />",
      errors: [{ messageId: "misplaced" }],
    },
  ],
})

/*
 * WHO MAY HOLD A `host: "main"` FRAME, asserted on the predicate rather than through RuleTester.
 *
 * The host-based shape can only be recognised by reading the repository's contract TABLE, and a
 * RuleTester case has no table on disk to read - `contractHostOf` returns null there and the case
 * would pass while proving nothing. So the boundary itself is the unit under test, and the
 * end-to-end behaviour is proven where a real table exists: `npx eslint .` in each consuming
 * repository, which is wired into the `lint` script people already run.
 */
test("LANDMARK: the page tier owns the screen, so it may hold the document's main", () => {
  for (const owner of [
    "D:/repo/src/components/pages/DashboardPage/index.tsx",
    "D:/repo/src/components/pages/DashboardPage/component.tsx",
    "D:/repo/apps/app/src/components/pages/ProvisioningPage/index.tsx",
  ]) {
    assert.equal(isPageTierFile(owner), true, `${owner} owns a whole screen`)
  }

  /*
   * Everything below a page is a PART of a screen. A landmark added there is a second main, which is
   * the case this law was written for and the one that must keep reporting.
   */
  for (const part of [
    "D:/repo/src/components/blocks/dashboard/DailyQuest/index.tsx",
    "D:/repo/src/components/composites/StatRow/index.tsx",
    "D:/repo/src/components/layouts/ShellNav/index.tsx",
    "D:/repo/src/components/overlays/auth/SignInOverlay/index.tsx",
    "D:/repo/src/components/pages/DashboardPage/parts.tsx",
  ]) {
    assert.equal(isPageTierFile(part), false, `${part} is a part of a screen, not the screen`)
  }

  // The two owners are distinct sets, and neither swallows the other.
  assert.equal(isRouteFile("D:/repo/src/app/dashboard/page.tsx"), true)
  assert.equal(isPageTierFile("D:/repo/src/app/dashboard/page.tsx"), false)
  assert.equal(isRouteFile("D:/repo/src/components/pages/DashboardPage/index.tsx"), false)
})
