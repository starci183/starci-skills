/** R91 source authoring and source-layout proofs for the shared front-end standard. */
// proves: FE_SOURCE_FORM@lite
// proves: FE_SOURCE_FORM@full
// proves: FE_SOURCE_LAYOUT_INVALID@lite
// proves: FE_SOURCE_LAYOUT_INVALID@full
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { at, FE_DECLARATION, fixtureHfs } from "./fixtures/typed/tester.mjs"
import { noEmojiInSource, noVietnameseInSource, requireExportJsdoc } from "./comments.mjs"
import {
  exportMatchesFolder,
  monorepoTierBelongsToItsSide,
  noHelperFolderInComponents,
  noRuntimeNamespace,
  noShellTier,
  routeSlotFixedName,
  routeTreeHoldsRoutesOnly,
  sourceTierMarkerMatchesFolder,
  surfaceFolderTwoFilesOnly,
} from "./file-layout.mjs"
import { handlerOnPrefix, noDirectConstAlias, preferArrowExport, rules as namingRules } from "./naming.mjs"
import { rules as graphRules } from "./project-graph.mjs"

const LEAF = at("apps/web/src/components/leaves/Text/index.tsx")
const BRANCH = at("apps/web/src/components/branches/ModalBranch/index.tsx")
const PAGE = at("apps/web/src/features/pages/HomePage/index.tsx")
const ROUTE = at("apps/web/src/app/[locale]/page.tsx")

for (const edition of ["lite", "full"]) {
  test(`R91 accepts valid source and rejects invalid authoring in ${edition}`, () => {
    const hfs = fixtureHfs(FE_DECLARATION, { lite: edition === "lite" })
    assert.equal(hfs.edition, edition)
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
      settings: { starci: { hfs } },
    })
    tester.run("require-export-jsdoc", requireExportJsdoc, {
      valid: [{ filename: LEAF, code: "/** Renders readable text. */\nexport const Text = () => null" }],
      invalid: [{ filename: LEAF, code: "export const Text = () => null", errors: [{ messageId: "jsdoc" }] }],
    })
    tester.run("no-emoji-in-source", noEmojiInSource, {
      valid: [{ filename: LEAF, code: 'const message = "Ready"' }],
      invalid: [{ filename: LEAF, code: 'const message = "\u{1f389}"', errors: [{ messageId: "emoji" }] }],
    })
    tester.run("no-vietnamese-in-source", noVietnameseInSource, {
      valid: [{ filename: LEAF, code: 'const message = "Deadline passed"' }],
      invalid: [{ filename: LEAF, code: 'const message = "h\u1ea1n cu\u1ed1i"', errors: [{ messageId: "vietnamese" }] }],
    })
    tester.run("no-shell-tier", noShellTier, {
      valid: [{ filename: BRANCH, code: "export const ModalBranch = () => null" }],
      invalid: [{ filename: at("apps/web/src/components/shells/ModalShell/index.tsx"), code: "export const ModalShell = () => null", errors: [{ messageId: "shell" }] }],
    })
    tester.run("source-tier-marker-matches-folder", sourceTierMarkerMatchesFolder, {
      valid: [{ filename: BRANCH, code: "export const meta = { shape: 'branch' } as const" }],
      invalid: [{ filename: BRANCH, code: "export const meta = { shape: 'shell' } as const", errors: [{ messageId: "mismatch" }] }],
    })
    tester.run("surface-folder-two-files-only", surfaceFolderTwoFilesOnly, {
      valid: [{ filename: PAGE, code: "export const HomePage = () => null" }],
      invalid: [{ filename: at("apps/web/src/features/pages/HomePage/helper.ts"), code: "export const helper = () => null", errors: [{ messageId: "extra" }] }],
    })
    tester.run("route-tree-holds-routes-only", routeTreeHoldsRoutesOnly, {
      valid: [{ filename: ROUTE, code: "const Page = () => null; export default Page" }],
      invalid: [{ filename: at("apps/web/src/app/[locale]/helper.ts"), code: "export const helper = () => null", errors: [{ messageId: "stray" }] }],
    })
    tester.run("route-slot-fixed-name", routeSlotFixedName, {
      valid: [{ filename: ROUTE, code: "const Page = () => null; export default Page" }],
      invalid: [{ filename: ROUTE, code: "const LandingPage = () => null; export default LandingPage", errors: [{ messageId: "wrong" }] }],
    })
    tester.run("no-helper-folder-in-components", noHelperFolderInComponents, {
      valid: [{ filename: at("apps/web/src/modules/utils/format.ts"), code: "export const format = () => null" }],
      invalid: [{ filename: at("apps/web/src/components/leaves/Text/utils/format.ts"), code: "export const format = () => null", errors: [{ messageId: "helper" }] }],
    })
    tester.run("export-matches-folder", exportMatchesFolder, {
      valid: [{ filename: LEAF, code: "export const Text = () => null" }],
      invalid: [{ filename: LEAF, code: "export const Paragraph = () => null", errors: [{ messageId: "mismatch" }] }],
    })
    tester.run("no-runtime-namespace", noRuntimeNamespace, {
      valid: ["export const CardRoot = () => null; export const CardHeader = () => null"],
      invalid: [{ code: "export const Card = { Root: CardRoot, Header: CardHeader }", errors: [{ messageId: "namespace" }] }],
    })
    tester.run("monorepo-tier-belongs-to-its-side", monorepoTierBelongsToItsSide, {
      valid: [{ filename: at("packages/nivo-ui/src/leaves/Text/index.tsx"), code: "export const Text = () => null" }],
      invalid: [{ filename: LEAF, code: "export const Text = () => null", errors: [{ messageId: "vocabularyInApp" }] }],
    })
    tester.run("prefer-arrow-export", preferArrowExport, {
      valid: ["export const Text = () => null"],
      invalid: [{ code: "export function Text() { return null }", errors: [{ messageId: "fn" }] }],
    })
    tester.run("handler-on-prefix", handlerOnPrefix, {
      valid: ["const onSubmit = () => submit()"],
      invalid: [{ code: "const handleSubmit = () => submit()", errors: [{ messageId: "handle" }] }],
    })
    tester.run("no-second-language-in-path", namingRules["no-second-language-in-path"], {
      valid: [{ filename: at("apps/web/src/app/[locale]/sign-in/page.tsx"), code: "export const value = 1" }],
      invalid: [{ filename: at("apps/web/src/app/[locale]/dang-nhap/page.tsx"), code: "export const value = 1", errors: [{ messageId: "path" }] }],
    })
    tester.run("no-direct-const-alias", noDirectConstAlias, {
      valid: ["const value = source + 1"],
      invalid: [{ code: "const value = source", errors: [{ messageId: "alias" }] }],
    })
  })

  test(`R91 accepts valid tier placement and rejects invalid source layout in ${edition}`, (t) => {
    const validPath = "apps/web/src/modules/catalog/read-catalog.ts"
    const invalidPath = "apps/web/src/config.ts"
    const validCode = "export const readCatalog = () => 'ready'\n"
    const invalidCode = "export const config = 1\n"
    const fixture = projectFixture({ profile: "fe", edition, files: { [validPath]: validCode, [invalidPath]: invalidCode } })
    t.after(fixture.cleanup)
    fixture.tester.run("frontend-source-layout", graphRules["frontend-source-layout"], {
      valid: [{ filename: fixture.at(validPath), code: validCode }],
      invalid: [{ filename: fixture.at(invalidPath), code: invalidCode, errors: [{ messageId: "finding", data: { message: "[FE_SOURCE_LAYOUT_INVALID] Production source under a Next application root must belong to app, features, components, hooks or modules, or be a framework-pinned root file Next.js loads from the source root (knowledge/patterns/fe/folder.yaml FE-FOLDER-1 frameworkPinnedRootFiles); configuration cannot hide an unclassified owner." } }] }],
    })
  })
}
