/**
 * Twin tests for the file-layout rules.
 *
 *   node --test file-layout.spec.mjs
 *
 * These rules ask the HFS slot view, so the cases that matter are the ones where a path looks governed and
 * is not (a folder named like a layer that no slot owns) and where it is governed at an unusual place.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, FE_DECLARATION, slotTester } from "./fixtures/typed/tester.mjs"
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
} from "./file-layout.mjs"

const tester = slotTester()
const NO_PACKAGE = slotTester({ declaration: { ...FE_DECLARATION, optionalSlots: [] } })
const ONE_APP_WITH_PACKAGE = slotTester({ declaration: { ...FE_DECLARATION, apps: [{ name: "web", kind: "next" }] } })

const R = "apps/web/src/components"
const F = "apps/web/src/features"
const cmp = "export const P = () => null"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("FILE-2: a surface folder holds its two halves and their twins", () => {
  tester.run("surface-folder-two-files-only", surfaceFolderTwoFilesOnly, {
    valid: [
      { filename: at(`${F}/pages/DashboardPage/index.tsx`), code: cmp },
      { filename: at(`${F}/pages/DashboardPage/component.tsx`), code: cmp },
      { filename: at(`${F}/pages/DashboardPage/classNames.ts`), code: cmp },
      { filename: at(`${F}/overlays/auth/SignInOverlay/index.tsx`), code: cmp },
      // blocks and composites are NOT surface folders - they may hold more than two files
      { filename: at(`${R}/blocks/dashboard/DailyQuest/parts.tsx`), code: cmp },
      // a folder named like a surface tier that no slot owns is not judged here
      { filename: at("apps/web/src/modules/pages/DashboardPage/extra.ts"), code: cmp },
      { filename: at(`${R}/pages/DashboardPage/extra.ts`), code: cmp },
    ],
    invalid: [
      { filename: at(`${F}/pages/DashboardPage/DailyQuest.tsx`), code: cmp, errors: [{ messageId: "extra" }] },
      { filename: at(`${F}/layouts/ShellNav/utils/format.ts`), code: cmp, errors: [{ messageId: "extra" }] },
      // a nested folder is not a half, even one that holds an `index.tsx`
      { filename: at(`${F}/pages/DashboardPage/sub/index.tsx`), code: cmp, errors: [{ messageId: "extra" }] },
      { filename: at(`${F}/overlays/auth/SignInOverlay/helper.ts`), code: cmp, errors: [{ messageId: "extra" }] },
    ],
  })
})

test("FILE-6: the routing tree holds route files and nothing else", () => {
  const A = "apps/web/src/app"
  const L = `${A}/[locale]`
  tester.run("route-tree-holds-routes-only", routeTreeHoldsRoutesOnly, {
    valid: [
      // The framework slots, at the root and nested under segments and groups.
      { filename: at(`${A}/page.tsx`), code: "export default () => null" },
      { filename: at(`${L}/layout.tsx`), code: "export default () => null" },
      { filename: at(`${A}/providers.tsx`), code: "export const P = () => null" },
      { filename: at(`${A}/globals.css`), code: "" },
      { filename: at(`${L}/provisioning/page.tsx`), code: "export default () => null" },
      { filename: at(`${L}/(auth)/sign-in/page.tsx`), code: "export default () => null" },
      { filename: at(`${L}/provisioning/loading.tsx`), code: "export default () => null" },
      { filename: at(`${L}/not-found.tsx`), code: "export default () => null" },
      { filename: at(`${A}/global-error.tsx`), code: "export default () => null" },
      // next-intl: a request outside every locale renders the root not-found, inside a root layout that returns its children
      { filename: at(`${A}/not-found.tsx`), code: "export default () => null" },
      { filename: at(`${A}/layout.tsx`), code: "export default ({ children }) => children" },
      { filename: at(`${A}/opengraph-image.tsx`), code: "export default () => null" },
      // Server code and the Next opt-out folder are not screens and are not this rule business.
      { filename: at(`${A}/api/health/route.ts`), code: "export const GET = () => null" },
      { filename: at(`${A}/_lib/token.ts`), code: "export const t = 1" },
      // A page owner in the tier that groups it with its siblings.
      { filename: at(`${F}/pages/ProvisioningPage/component.tsx`), code: cmp },
      // The second app of the repository has its own routing tree, judged the same way.
      { filename: at("apps/admin/src/app/[locale]/dashboard/page.tsx"), code: "export default () => null" },
      // a default slot and a nested route handler
      { filename: at(`${L}/@modal/default.tsx`), code: "export default () => null" },
      { filename: at(`${L}/api/webhook/route.ts`), code: "export const POST = () => null" },
      // a folder called `app` that no slot owns is not a routing tree
      { filename: at("apps/web/src/modules/app/helper.ts"), code: "export const t = 1" },
    ],
    invalid: [
      // a root error/loading boundary and a segment that is not [locale] are not what the route slot names
      { filename: at(`${A}/error.tsx`), code: "export default () => null", errors: [{ messageId: "stray" }] },
      { filename: at(`${A}/loading.tsx`), code: "export default () => null", errors: [{ messageId: "stray" }] },
      { filename: at(`${A}/[lang]/page.tsx`), code: "export default () => null", errors: [{ messageId: "stray" }] },
      // The exact file this rule was written for: it built, linted, typechecked and was approved.
      { filename: at(`${L}/provisioning/workers-page.tsx`), code: "export const WorkersPage = () => null", errors: [{ messageId: "stray" }] },
      { filename: at(`${L}/dashboard/DashboardHeader.tsx`), code: "export const H = () => null", errors: [{ messageId: "stray" }] },
      // `utils` is not a framework slot, and a route folder is not where a helper hides.
      { filename: at(`${L}/provisioning/utils.ts`), code: "export const f = () => null", errors: [{ messageId: "stray" }] },
      { filename: at("apps/admin/src/app/[locale]/users/UserList.tsx"), code: "export const f = () => null", errors: [{ messageId: "stray" }] },
    ],
  })
})

test("FILE-3: a helper folder under components has a real home elsewhere", () => {
  tester.run("no-helper-folder-in-components", noHelperFolderInComponents, {
    valid: [
      { filename: at(`${R}/leaves/Text/index.tsx`), code: cmp },
      { filename: at("apps/web/src/modules/utils/format.ts"), code: "export const f = () => null" },
      { filename: at("apps/web/src/hooks/swr/useX.ts"), code: "export const useX = () => null" },
      // a folder named `components` that no slot owns holds no component code
      { filename: at("apps/web/src/modules/components/utils/x.ts"), code: "export const f = () => null" },
      // a component or a category that happens to be called like a helper folder is a component, not a helper folder
      { filename: at(`${R}/leaves/utils/index.tsx`), code: cmp },
      { filename: at(`${R}/blocks/types/Card/index.tsx`), code: cmp },
      { filename: at("packages/nivo-ui/src/leaves/hooks/index.tsx"), code: cmp },
    ],
    invalid: [
      { filename: at(`${R}/blocks/dashboard/DailyQuest/utils/format.ts`), code: "export const f = () => null", errors: [{ messageId: "helper" }] },
      { filename: at(`${R}/leaves/Text/constants/tone.ts`), code: "export const TONE = 1", errors: [{ messageId: "helper" }] },
      { filename: at(`${R}/blocks/dashboard/constants/tone.ts`), code: "export const TONE = 1", errors: [{ messageId: "helper" }] },
      { filename: at("packages/nivo-ui/src/leaves/Text/types/tone.ts"), code: "export const TONE = 1", errors: [{ messageId: "helper" }] },
    ],
  })
})

test("FILE-1: the path predicts the name", () => {
  tester.run("export-matches-folder", exportMatchesFolder, {
    valid: [
      { filename: at(`${R}/leaves/Text/index.tsx`), code: "export const Text = () => null" },
      { filename: at(`${R}/leaves/Text/index.tsx`), code: "export const TextLink = () => null" },
      { filename: at(`${F}/overlays/auth/SignInOverlay/index.tsx`), code: "export const SignInOverlay = () => null" },
      { filename: at("packages/nivo-ui/src/leaves/Text/index.tsx"), code: "export const Text = () => null" },
      // a file exporting nothing has nothing to disagree with
      { filename: at(`${R}/leaves/Text/index.tsx`), code: "const Text = () => null" },
      // not a PascalCase component folder
      { filename: at("apps/web/src/hooks/swr/index.ts"), code: "export const useX = () => null" },
      // a PascalCase folder no component slot owns is not a component folder
      { filename: at("apps/web/src/modules/Legacy/index.tsx"), code: "export const Other = () => null" },
      // the drawing half is not the entry
      { filename: at(`${R}/leaves/Text/component.tsx`), code: "export const Paragraph = () => null" },
    ],
    invalid: [
      { filename: at(`${R}/leaves/Text/index.tsx`), code: "export const Paragraph = () => null", errors: [{ messageId: "mismatch" }] },
      { filename: at("packages/nivo-ui/src/leaves/Text/index.tsx"), code: "export const Paragraph = () => null", errors: [{ messageId: "mismatch" }] },
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
      { code: "export const Card = { Root: CardRoot, Header: CardHeader }", errors: [{ messageId: "namespace" }] },
      { code: "export const Chip = { Dot: ChipDot, Label: ChipLabel } as const", errors: [{ messageId: "namespace" }] },
    ],
  })
})

/**
 * FILE-5: which side of the feature line a layer sits on comes from the slots (`fe.package.ui` kinds against the
 * component and feature layers), and an app holds the shared layers only when the repository declares the UI package.
 */
test("FILE-5: each tier sits on its own side of the feature line", () => {
  tester.run("monorepo-tier-belongs-to-its-side", monorepoTierBelongsToItsSide, {
    valid: [
      // The shared package holds the tiers that know no feature.
      { filename: at("packages/nivo-ui/src/leaves/Badge/index.tsx"), code: "export const Badge = () => null" },
      { filename: at("packages/nivo-ui/src/branches/ModalBranch/index.tsx"), code: "export const ModalBranch = () => null" },
      { filename: at("packages/nivo-ui/src/index.ts"), code: "export const x = 1" },
      // a folder of the package that is no layer at all is another rule business
      { filename: at("packages/nivo-ui/src/utils/format.ts"), code: "export const f = () => null" },
      // The app holds the tiers that know one.
      { filename: at("apps/web/src/components/blocks/workers/WorkerRow/index.tsx"), code: "export const WorkerRow = () => null" },
      { filename: at("apps/web/src/features/pages/WorkersPage/component.tsx"), code: "export const WorkersPageBase = () => null" },
      // a folder named like a shared layer that no slot owns is not a component
      { filename: at("apps/web/src/modules/components/leaves/Badge.ts"), code: "export const Badge = () => null" },
    ],
    invalid: [
      // The failure this rule was written for: a domain sentence in the shared package.
      { filename: at("packages/nivo-ui/src/blocks/WorkerRow/index.tsx"), code: "export const WorkerRow = () => null", errors: [{ messageId: "featureInPackage" }] },
      { filename: at("packages/nivo-ui/src/pages/WorkersPage/component.tsx"), code: "export const WorkersPageBase = () => null", errors: [{ messageId: "featureInPackage" }] },
      // The mirror image: shared vocabulary trapped inside one app.
      { filename: at("apps/web/src/components/leaves/Badge/index.tsx"), code: "export const Badge = () => null", errors: [{ messageId: "vocabularyInApp" }] },
      { filename: at("apps/admin/src/components/composites/Table/index.tsx"), code: "export const Table = () => null", errors: [{ messageId: "vocabularyInApp" }] },
    ],
  })
  // A repository that declares no UI package has nowhere to share a leaf to: its app holds its own vocabulary.
  NO_PACKAGE.run("monorepo-tier-belongs-to-its-side (no ui package)", monorepoTierBelongsToItsSide, {
    valid: [
      { filename: at("apps/web/src/components/leaves/Badge/index.tsx"), code: "export const Badge = () => null" },
      { filename: at("apps/web/src/components/branches/Modal/index.tsx"), code: "export const Modal = () => null" },
    ],
    invalid: [],
  })
  // With one app there is no cross-app sharing boundary, even when the optional package slot is declared.
  ONE_APP_WITH_PACKAGE.run("monorepo-tier-belongs-to-its-side (one app)", monorepoTierBelongsToItsSide, {
    valid: [
      { filename: at("apps/web/src/components/composites/SiteShell/index.tsx"), code: "export const SiteShell = () => null" },
      { filename: at("packages/nivo-ui/src/blocks/FleetRow/index.tsx"), code: "export const FleetRow = () => null" },
    ],
    invalid: [],
  })
})

test("FILE-7: the source marker and owning tier agree", () => {
  tester.run("source-tier-marker-matches-folder", sourceTierMarkerMatchesFolder, {
    valid: [
      { filename: at(`${R}/branches/ModalBranch/index.tsx`), code: "export const meta = { shape: 'branch' } as const" },
      { filename: at(`${F}/overlays/auth/SignInOverlay/component.tsx`), code: "export const meta = { shape: 'overlay' } as const" },
      { filename: at(`${F}/pages/Home/index.tsx`), code: "export const meta = { shape: 'page' } as const" },
      { filename: at("packages/nivo-ui/src/leaves/Badge/index.tsx"), code: "export const meta = { shape: 'leaf' } as const" },
      // a folder named like a layer that no slot owns declares nothing to agree with
      { filename: at("apps/web/src/modules/components/leaves/x.ts"), code: "export const meta = { shape: 'shell' } as const" },
    ],
    invalid: [
      { filename: at(`${R}/branches/ModalBranch/index.tsx`), code: "export const meta = { shape: 'shell' } as const", errors: [{ messageId: "mismatch" }] },
      { filename: at("packages/nivo-ui/src/leaves/Badge/index.tsx"), code: "export const meta = { shape: 'block' } as const", errors: [{ messageId: "mismatch" }] },
      { filename: at(`${F}/pages/Home/index.tsx`), code: "export const meta = { shape: 'layout' } as const", errors: [{ messageId: "mismatch" }] },
    ],
  })
})

test("FILE-8: shells are not a component tier", () => {
  tester.run("no-shell-tier", noShellTier, {
    valid: [
      { filename: at(`${R}/branches/ModalBranch/index.tsx`), code: "export const ModalBranch = () => null" },
      { filename: at("packages/nivo-ui/src/branches/ModalBranch/index.tsx"), code: "export const ModalBranch = () => null" },
      // another unknown folder is HFS_SLOT_UNDECLARED to name, and a `shells` folder outside the component tier is no shell tier
      { filename: at(`${R}/pages/Home/index.tsx`), code: "export const Home = () => null" },
      { filename: at("apps/web/src/modules/shells/x.ts"), code: "export const x = 1" },
    ],
    invalid: [
      { filename: at(`${R}/shells/ModalShell/index.tsx`), code: "export const ModalShell = () => null", errors: [{ messageId: "shell" }] },
      { filename: at("packages/nivo-ui/src/shells/ModalShell/index.tsx"), code: "export const ModalShell = () => null", errors: [{ messageId: "shell" }] },
    ],
  })
})

test("FILE-9: a route slot default-exports a component named after the slot", () => {
  const app = "apps/web/src/app"
  tester.run("route-slot-fixed-name", routeSlotFixedName, {
    valid: [
      { filename: at(`${app}/[lang]/page.tsx`), code: "const Page = () => <LandingPage />; export default Page" },
      { filename: at(`${app}/[lang]/layout.tsx`), code: "export default function Layout() { return null }" },
      { filename: at(`${app}/loading.tsx`), code: "const Loading = () => null; export default Loading" },
      { filename: at(`${app}/not-found.tsx`), code: "const NotFound = () => null; export default NotFound" },
      { filename: at(`${app}/global-error.tsx`), code: "const GlobalError = () => null; export default GlobalError" },
      { filename: at(`${app}/error.tsx`), code: "export { ErrorBoundary as default } from './boundary'" },
      { filename: at(`${app}/error.tsx`), code: "const ErrorBoundary = () => null; export default ErrorBoundary" },
      { filename: at(`${app}/default.tsx`), code: "const Anything = () => null; export default Anything" },
      { filename: at(`${app}/route.ts`), code: "export const GET = () => null" },
      // outside the route tree entirely, including a feature owner entry and a folder that is merely named `app`
      { filename: at(`${F}/pages/LandingPage/index.tsx`), code: "const LandingPage = () => null; export default LandingPage" },
      { filename: at("apps/web/src/modules/app/page.tsx"), code: "const Home = () => null; export default Home" },
    ],
    invalid: [
      { filename: at(`${app}/[lang]/page.tsx`), code: "const LandingPage = () => null; export default LandingPage", errors: [{ messageId: "wrong" }] },
      { filename: at(`${app}/[lang]/page.tsx`), code: "export default function LandingPage() { return null }", errors: [{ messageId: "wrong" }] },
      { filename: at(`${app}/[lang]/page.tsx`), code: "export default () => null", errors: [{ messageId: "anonymous" }] },
      { filename: at(`${app}/[lang]/layout.tsx`), code: "const Shell = () => null; export default Shell", errors: [{ messageId: "wrong" }] },
      { filename: at(`${app}/global-error.tsx`), code: "const Oops = () => null; export default Oops", errors: [{ messageId: "wrong" }] },
      // `Error` shadows the global constructor (Sonar S2137): the error slot is `ErrorBoundary`.
      { filename: at(`${app}/error.tsx`), code: "const Error = () => null; export default Error", errors: [{ messageId: "wrong" }] },
      { filename: at("apps/admin/src/app/[locale]/page.tsx"), code: "export const metadata = {}", errors: [{ messageId: "missing" }] },
    ],
  })
})
