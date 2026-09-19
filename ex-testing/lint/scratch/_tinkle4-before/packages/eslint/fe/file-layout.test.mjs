/**
 * Twin tests for the file-layout rules.
 *
 *   node --test file-layout.test.mjs
 *
 * These rules read the PATH, so the cases that matter are the ones where a path looks governed and
 * is not. A path rule that widens by one segment starts firing on a whole tier at once.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  noShellTier,
  sourceTierMarkerMatchesFolder,
  exportMatchesFolder,
  monorepoTierBelongsToItsSide,
  noHelperFolderInComponents,
  noRuntimeNamespace,
  routeTreeHoldsRoutesOnly,
  routeSlotFixedName,
  rules,
  surfaceFolderTwoFilesOnly,
  unitTestColocated,
} from "./file-layout.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const R = "D:/repo/src/components"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("FILE-2: a surface folder holds its two halves and their twins", () => {
  tester.run("surface-folder-two-files-only", surfaceFolderTwoFilesOnly, {
    valid: [
      { filename: `${R}/pages/DashboardPage/index.tsx`, code: "export const P = () => null" },
      { filename: `${R}/pages/DashboardPage/component.tsx`, code: "export const P = () => null" },
      { filename: `${R}/pages/DashboardPage/component.spec.tsx`, code: "export const P = () => null" },
      { filename: `${R}/overlays/auth/SignInOverlay/index.tsx`, code: "export const O = () => null" },
      // blocks and composites are NOT surface folders - they may hold more than two files
      { filename: `${R}/blocks/dashboard/DailyQuest/parts.tsx`, code: "export const X = () => null" },
    ],
    invalid: [
      {
        filename: `${R}/pages/DashboardPage/component.test.tsx`,
        code: "export const P = () => null",
        errors: [{ messageId: "extra" }],
      },
      {
        filename: `${R}/pages/DashboardPage/DailyQuest.tsx`,
        code: "export const X = () => null",
        errors: [{ messageId: "extra" }],
      },
      {
        filename: `${R}/layouts/ShellNav/utils/format.ts`,
        code: "export const f = () => null",
        errors: [{ messageId: "extra" }],
      },
    ],
  })
})

test("FILE-6: the routing tree holds route files and nothing else", () => {
  const A = "D:/repo/apps/app/src/app"
  tester.run("route-tree-holds-routes-only", routeTreeHoldsRoutesOnly, {
    valid: [
      // The framework's own slots, at the root and nested under segments and groups.
      { filename: `${A}/page.tsx`, code: "export default () => null" },
      { filename: `${A}/layout.tsx`, code: "export default () => null" },
      { filename: `${A}/providers.tsx`, code: "export const P = () => null" },
      { filename: `${A}/globals.css`, code: "" },
      { filename: `${A}/provisioning/page.tsx`, code: "export default () => null" },
      { filename: `${A}/(auth)/sign-in/page.tsx`, code: "export default () => null" },
      { filename: `${A}/provisioning/loading.tsx`, code: "export default () => null" },
      { filename: `${A}/not-found.tsx`, code: "export default () => null" },
      { filename: `${A}/opengraph-image.tsx`, code: "export default () => null" },
      // Server code and Next's own opt-out folder are not screens and are not this rule's business.
      { filename: `${A}/api/health/route.ts`, code: "export const GET = () => null" },
      { filename: `${A}/_lib/token.ts`, code: "export const t = 1" },
      // The single-app tree, same law, no `apps/<app>` prefix.
      { filename: "D:/repo/src/app/dashboard/page.tsx", code: "export default () => null" },
      // A page owner in the tier that groups it with its siblings.
      { filename: "D:/repo/apps/app/src/components/pages/ProvisioningPage/component.tsx", code: "export const P = () => null" },
      /*
       * Twin tests beside the route they test. A test ships in no bundle and no route renders it, so
       * it cannot become the second page this rule exists to prevent - and pushing route tests out
       * of the directory the next reader looks in is the opposite of the twin-test habit. The names
       * split by concern rather than matching `page`, which is how route tests are actually written.
       */
      { filename: `${A}/dashboard/access.spec.tsx`, code: "export const t = 1" },
      { filename: `${A}/(auth)/screen.spec.tsx`, code: "export const t = 1" },
      { filename: `${A}/(auth)/layout-boundary.spec.ts`, code: "export const t = 1" },
    ],
    invalid: [
      {
        filename: `${A}/dashboard/access.test.tsx`,
        code: "export const t = 1",
        errors: [{ messageId: "stray" }],
      },
      /*
       * The exact file this rule was written for. It built, linted, typechecked, produced four
       * sealed screenshots and was approved - because the law that refused it was only prose.
       */
      {
        filename: `${A}/provisioning/fleet-page.tsx`,
        code: "export const FleetPage = () => null",
        errors: [{ messageId: "stray" }],
      },
      {
        filename: `${A}/dashboard/DashboardHeader.tsx`,
        code: "export const H = () => null",
        errors: [{ messageId: "stray" }],
      },
      // `utils` is not a framework slot, and a route folder is not where a helper hides.
      {
        filename: `${A}/provisioning/utils.ts`,
        code: "export const f = () => null",
        errors: [{ messageId: "stray" }],
      },
    ],
  })
})

test("FILE-9: frontend unit specs stay beside their owner", () => {
  tester.run("unit-test-colocated", unitTestColocated, {
    valid: [
      { filename: "D:/repo/src/modules/api/query-user.spec.ts", code: "export const x = 1" },
      { filename: "D:/repo/src/components/pages/UserPage/index.spec.tsx", code: "export const x = 1" },
      { filename: "D:/repo/scripts/check-quality.spec.mjs", code: "export const x = 1" },
    ],
    invalid: [
      { filename: "D:/repo/src/modules/api/query-user.test.ts", code: "export const x = 1", errors: [{ messageId: "suffix" }] },
      { filename: "D:/repo/src/tests/query-user.spec.ts", code: "export const x = 1", errors: [{ messageId: "bucket" }] },
      { filename: "D:/repo/e2e/http-smoke.spec.mjs", code: "export const x = 1", errors: [{ messageId: "bucket" }] },
    ],
  })
})

test("FILE-3: a helper folder under components has a real home elsewhere", () => {
  tester.run("no-helper-folder-in-components", noHelperFolderInComponents, {
    valid: [
      { filename: `${R}/leaves/Text/index.tsx`, code: "export const T = () => null" },
      { filename: "D:/repo/src/modules/utils/format.ts", code: "export const f = () => null" },
      { filename: "D:/repo/src/hooks/swr/useX.ts", code: "export const useX = () => null" },
    ],
    invalid: [
      {
        filename: `${R}/blocks/dashboard/DailyQuest/utils/format.ts`,
        code: "export const f = () => null",
        errors: [{ messageId: "helper" }],
      },
      {
        filename: `${R}/leaves/Text/constants/tone.ts`,
        code: "export const TONE = 1",
        errors: [{ messageId: "helper" }],
      },
    ],
  })
})

test("FILE-1: the path predicts the name", () => {
  tester.run("export-matches-folder", exportMatchesFolder, {
    valid: [
      { filename: `${R}/leaves/Text/index.tsx`, code: "export const Text = () => null" },
      { filename: `${R}/leaves/Text/index.tsx`, code: "export const TextLink = () => null" },
      // a file exporting nothing has nothing to disagree with
      { filename: `${R}/leaves/Text/index.tsx`, code: "const Text = () => null" },
      // not a PascalCase component folder
      { filename: "D:/repo/src/hooks/swr/index.ts", code: "export const useX = () => null" },
    ],
    invalid: [
      {
        filename: `${R}/leaves/Text/index.tsx`,
        code: "export const Paragraph = () => null",
        errors: [{ messageId: "mismatch" }],
      },
    ],
  })
})

test("FILE-4: a family is exported as members, not as one object", () => {
  tester.run("no-runtime-namespace", noRuntimeNamespace, {
    valid: [
      "export const CardRoot = () => null",
      // data, not a component family - the members are not component-shaped names
      "export const TONE = { muted: \"a\", accent: \"b\" }",
      // one member is not a namespace
      "export const Card = { Root: CardRoot }",
    ],
    invalid: [
      {
        code: "export const Card = { Root: CardRoot, Header: CardHeader }",
        errors: [{ messageId: "namespace" }],
      },
      {
        code: "export const Chip = { Dot: ChipDot, Label: ChipLabel } as const",
        errors: [{ messageId: "namespace" }],
      },
    ],
  })
})

/**
 * FILE-5, and the cases that decide it are the SINGLE-APP ones.
 *
 * This rule keys on `packages/<name>/src/` and `apps/<name>/src/`, so a repository that has neither
 * must match nothing at all. A path rule that widens by one segment starts firing on a whole tier
 * at once, and the tier it would fire on here is every block in every single-app repository.
 */
test("FILE-5: each tier sits on its own side of the feature line", () => {
  tester.run("monorepo-tier-belongs-to-its-side", monorepoTierBelongsToItsSide, {
    valid: [
      // The shared package holds the tiers that know no feature.
      { filename: "D:/repo/packages/ui/src/leaves/Badge/index.tsx", code: "export const Badge = () => null" },
      { filename: "D:/repo/packages/ui/src/branches/ModalBranch/index.tsx", code: "export const ModalBranch = () => null" },
      // The app holds the tiers that know one.
      { filename: "D:/repo/apps/web/src/components/blocks/fleet/FleetRow/index.tsx", code: "export const FleetRow = () => null" },
      { filename: "D:/repo/apps/web/src/components/pages/FleetPage/component.tsx", code: "export const FleetPageBase = () => null" },
      // A single-app repository has neither prefix and is governed by the rest of this law.
      { filename: "D:/repo/src/components/blocks/dashboard/DailyQuest/index.tsx", code: "export const DailyQuest = () => null" },
      { filename: "D:/repo/src/components/leaves/Badge/index.tsx", code: "export const Badge = () => null" },
    ],
    invalid: [
      {
        // The failure this rule was written for: a domain sentence in the shared package.
        filename: "D:/repo/packages/ui/src/blocks/FleetRow/index.tsx",
        code: "export const FleetRow = () => null",
        errors: [{ messageId: "featureInPackage" }],
      },
      {
        filename: "D:/repo/packages/ui/src/pages/FleetPage/component.tsx",
        code: "export const FleetPageBase = () => null",
        errors: [{ messageId: "featureInPackage" }],
      },
      {
        // The mirror image: shared vocabulary trapped inside one app.
        filename: "D:/repo/apps/web/src/components/leaves/Badge/index.tsx",
        code: "export const Badge = () => null",
        errors: [{ messageId: "vocabularyInApp" }],
      },
    ],
  })
})

test("FILE-7: the source marker and owning tier agree", () => {
  tester.run("source-tier-marker-matches-folder", sourceTierMarkerMatchesFolder, {
    valid: [
      { filename: `${R}/branches/ModalBranch/index.tsx`, code: "export const meta = { shape: 'branch' } as const" },
      { filename: `${R}/overlays/auth/SignInOverlay/component.tsx`, code: "export const meta = { shape: 'overlay' } as const" },
    ],
    invalid: [{ filename: `${R}/branches/ModalBranch/index.tsx`, code: "export const meta = { shape: 'shell' } as const", errors: [{ messageId: "mismatch" }] }],
  })
})

test("FILE-8: shells are not a component tier", () => {
  tester.run("no-shell-tier", noShellTier, {
    valid: [{ filename: `${R}/branches/ModalBranch/index.tsx`, code: "export const ModalBranch = () => null" }],
    invalid: [{ filename: `${R}/shells/ModalShell/index.tsx`, code: "export const ModalShell = () => null", errors: [{ messageId: "shell" }] }],
  })
})

test("FILE-9: a route slot default-exports a component named after the slot", () => {
  const app = "D:/repo/src/app"
  tester.run("route-slot-fixed-name", routeSlotFixedName, {
    valid: [
      { filename: `${app}/[lang]/page.tsx`, code: "const Page = () => <LandingPage />; export default Page" },
      { filename: `${app}/[lang]/layout.tsx`, code: "export default function Layout() { return null }" },
      { filename: `${app}/loading.tsx`, code: "const Loading = () => null; export default Loading" },
      { filename: `${app}/not-found.tsx`, code: "const NotFound = () => null; export default NotFound" },
      { filename: `${app}/error.tsx`, code: "export { Error as default } from './boundary'" },
      { filename: `${app}/default.tsx`, code: "const Anything = () => null; export default Anything" },
      { filename: `${app}/route.ts`, code: "export const GET = () => null" },
      // spec twins are not slots
      { filename: `${app}/[lang]/layout.spec.tsx`, code: "const Whatever = () => null; export default Whatever" },
      // outside the route tree entirely
      { filename: "D:/repo/src/components/pages/LandingPage/index.tsx", code: "const LandingPage = () => null; export default LandingPage" },
    ],
    invalid: [
      {
        filename: `${app}/[lang]/page.tsx`,
        code: "const LandingPage = () => null; export default LandingPage",
        errors: [{ messageId: "wrong" }],
      },
      {
        filename: `${app}/[lang]/page.tsx`,
        code: "export default function LandingPage() { return null }",
        errors: [{ messageId: "wrong" }],
      },
      {
        filename: `${app}/[lang]/page.tsx`,
        code: "export default () => null",
        errors: [{ messageId: "anonymous" }],
      },
      {
        filename: `${app}/[lang]/layout.tsx`,
        code: "const Shell = () => null; export default Shell",
        errors: [{ messageId: "wrong" }],
      },
      {
        filename: `${app}/[lang]/page.tsx`,
        code: "export const metadata = {}",
        errors: [{ messageId: "missing" }],
      },
    ],
  })
})
