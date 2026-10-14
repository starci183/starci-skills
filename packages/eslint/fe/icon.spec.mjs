/**
 * Twin tests for the icon rules.
 *
 *   node --test icon.spec.mjs
 *
 * The case that matters most is the SUBPATH one. The original escape imported a vendor subpath,
 * and a check comparing a package name for equality does not see it - so that case is asserted
 * first and must never be deleted to make an import tidier.
 */
// proves: FE_ICON_INLINE_SVG@lite
// proves: FE_ICON_INLINE_SVG@full
import assert from "node:assert/strict"
import test from "node:test"
import { at, fixtureHfs, slotTester } from "./fixtures/typed/tester.mjs"
import {
  heroiconsIsTheGlyphVendor,
  noDecorativeIconInMetricCell,
  noInlineSvgOutsideBrandMarkLeaf,
  noOffScaleGlyphSize,
  noVendorIconOutsideIconLeaf,
  rules,
} from "./icon.mjs"

const tester = slotTester()

const R = "apps/web/src/components"
const ICON_LEAF = at(`${R}/leaves/Icon/index.tsx`)
const ICON_LEAF_BRANDS = at(`${R}/leaves/Icon/brands.tsx`)
const OTHER_LEAF = at(`${R}/leaves/SeeMoreLink/index.tsx`)
const BLOCK = at(`${R}/blocks/dashboard/DailyQuest/component.tsx`)
const METRIC_CELL = at(`${R}/composites/LabelledProgressRow/index.tsx`)
const SCRIPT = at("scripts/build.ts")
const PACKAGE_ICON_LEAF = at("packages/nivo-ui/src/leaves/Icon/index.tsx")
const NOT_A_LEAF = at("apps/web/src/modules/components/leaves/Icon/index.tsx")
const ICON_BLOCK = at(`${R}/blocks/dashboard/Icon/index.tsx`)

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("ICON-6: the icon leaf owns the library, and a subpath does not walk around it", () => {
  tester.run("no-vendor-icon-outside-icon-leaf", noVendorIconOutsideIconLeaf, {
    valid: [
      { filename: ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react/24/outline\"" },
      { filename: ICON_LEAF, code: "import { MindMapIcon } from \"@starci/heroicons/16/solid\"" },
      // a second file INSIDE the leaf folder is still the leaf
      { filename: ICON_LEAF_BRANDS, code: "import type { SVGProps } from \"react\"" },
      { filename: OTHER_LEAF, code: "import { Icon } from \"@/components/leaves/Icon\"" },
      { filename: BLOCK, code: "import { Link as HeroLink } from \"@heroui/react\"" },
      // tooling is out of scope
      { filename: SCRIPT, code: "import { X } from \"lucide-react\"" },
      // the toast region draws the status glyph of each toast; the modules tier cannot ask the icon leaf
      { filename: at("apps/web/src/modules/toast/toast.tsx"), code: "import { CheckCircleIcon, XCircleIcon } from \"@heroicons/react/24/outline\"" },
      // the icon leaf of the shared package owns the map there too
      { filename: PACKAGE_ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react/24/outline\"" },
    ],
    invalid: [
      // a file called like the icon leaf that no leaf slot owns is not the icon leaf, and neither is a block called Icon
      { filename: NOT_A_LEAF, code: "import { Star } from \"lucide-react\"", errors: [{ messageId: "vendor" }] },
      { filename: ICON_BLOCK, code: "import { Star } from \"lucide-react\"", errors: [{ messageId: "vendor" }] },
      // another module is not the toast module
      { filename: at("apps/web/src/modules/utils/glyphs.ts"), code: "import { StarIcon } from \"@heroicons/react/24/outline\"", errors: [{ messageId: "vendor" }] },
      {
        // the exact escape these rules were written for: a vendor subpath
        filename: OTHER_LEAF,
        code: "import { CaretRightIcon } from \"@phosphor-icons/react/dist/ssr\"",
        errors: [{ messageId: "vendor" }],
      },
      {
        filename: OTHER_LEAF,
        code: "import { ChevronRightIcon } from \"@heroicons/react/16/solid\"",
        errors: [{ messageId: "vendor" }],
      },
      { filename: BLOCK, code: "import { Star } from \"lucide-react\"", errors: [{ messageId: "vendor" }] },
      { filename: BLOCK, code: "import { FaBeer } from \"react-icons/fa\"", errors: [{ messageId: "vendor" }] },
      {
        filename: ICON_LEAF_BRANDS,
        code: "import { MindMapIcon } from \"@starci/heroicons/24/outline\"",
        errors: [{ messageId: "vendor" }],
      },
      {
        filename: OTHER_LEAF,
        code: "import Home from \"@mui/icons-material/Home\"",
        errors: [{ messageId: "vendor" }],
      },
      {
        filename: OTHER_LEAF,
        code: "import { Home } from \"some-glyph-catalogue\"",
        errors: [{ messageId: "vendor" }],
      },
    ],
  })
})

test("ICON-7: the heroicons family on its two cuts is the whole glyph surface", () => {
  tester.run("heroicons-is-the-glyph-vendor", heroiconsIsTheGlyphVendor, {
    valid: [
      { filename: ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react/24/outline\"" },
      { filename: ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react/16/solid\"" },
      // the StarCi custom cuts, on the same two subpaths
      { filename: ICON_LEAF, code: "import { MindMapIcon } from \"@starci/heroicons/24/outline\"" },
      { filename: ICON_LEAF, code: "import { MindMapIcon } from \"@starci/heroicons/16/solid\"" },
      { filename: PACKAGE_ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react/24/outline\"" },
      { filename: at("apps/web/src/modules/toast/toast.tsx"), code: "import { CheckCircleIcon } from \"@heroicons/react/24/outline\"" },
      { filename: ICON_LEAF_BRANDS, code: "import type { SVGProps } from \"react\"" },
      // tooling is out of scope
      { filename: SCRIPT, code: "import { Fire } from \"@phosphor-icons/react\"" },
    ],
    invalid: [
      // Phosphor is refused, its server-component subpath included
      { filename: ICON_LEAF, code: "import { Fire } from \"@phosphor-icons/react\"", errors: [{ messageId: "vendor" }] },
      { filename: ICON_LEAF, code: "import { Fire } from \"@phosphor-icons/react/dist/ssr\"", errors: [{ messageId: "vendor" }] },
      // a heroicons cut outside the two optical families, and the bare package root
      { filename: ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react/20/solid\"", errors: [{ messageId: "vendor" }] },
      { filename: ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react\"", errors: [{ messageId: "vendor" }] },
      { filename: ICON_LEAF, code: "import { MindMapIcon } from \"@starci/heroicons\"", errors: [{ messageId: "vendor" }] },
      { filename: ICON_LEAF, code: "import { Flame } from \"lucide-react\"", errors: [{ messageId: "vendor" }] },
      { filename: ICON_LEAF, code: "import { Icon } from \"@iconify/react\"", errors: [{ messageId: "vendor" }] },
      { filename: ICON_LEAF, code: "import Home from \"@mui/icons-material/Home\"", errors: [{ messageId: "vendor" }] },
      { filename: ICON_LEAF, code: "import { Home } from \"some-glyph-catalogue\"", errors: [{ messageId: "vendor" }] },
      { filename: BLOCK, code: "import { FaBeer } from \"react-icons-kit/fa\"", errors: [{ messageId: "vendor" }] },
    ],
  })
})

test("ICON-1: a glyph size off both steps is a third step", () => {
  tester.run("no-off-scale-glyph-size", noOffScaleGlyphSize, {
    valid: [
      { filename: OTHER_LEAF, code: "const C = \"size-4 shrink-0\"" },
      { filename: OTHER_LEAF, code: "const C = \"size-5 shrink-0\"" },
      // a script is not product source
      { filename: SCRIPT, code: "const C = \"size-[13px]\"" },
      { filename: BLOCK, code: "const E = () => <div className=\"size-8 rounded-lg\" />" },
      // a spacing utility that merely looks similar is not this rule's business
      { filename: BLOCK, code: "const C = \"gap-2 p-4\"" },
    ],
    invalid: [
      {
        // the escape: hoisted into a constant, where the JSX arm would never have seen it
        filename: OTHER_LEAF,
        code: "const CARET_CLASSES = \"size-3.5 shrink-0 transition-[translate]\"",
        errors: [{ messageId: "offScale" }],
      },
      {
        filename: BLOCK,
        code: "const E = () => <Glyph className=\"size-[13px]\" />",
        errors: [{ messageId: "offScale" }],
      },
    ],
  })
})

test("ICON-10: a repeated metric cell does not invent a decorative feature glyph", () => {
  tester.run("no-decorative-icon-in-metric-cell", noDecorativeIconInMetricCell, {
    valid: [
      {
        filename: METRIC_CELL,
        code: "const Row = () => <div><Text props={{ content: 'Content' }} /></div>",
      },
      // a leaf called like the metric cell is not the metric cell
      { filename: at(`${R}/leaves/LabelledProgressRow/index.tsx`), code: "const Row = () => <Icon props={{ name: 'course' }} />" },
      {
        filename: BLOCK,
        code: "const Entry = () => <Icon props={{ name: 'course' }} />",
      },
    ],
    invalid: [
      {
        filename: at("packages/nivo-ui/src/composites/LabelledProgressRow/index.tsx"),
        code: "const Row = () => <div><Icon props={{ name: 'course' }} /></div>",
        errors: [{ messageId: "decorative" }],
      },
      {
        filename: METRIC_CELL,
        code: "const Row = () => <div><Icon props={{ name: 'course' }} /><Text /></div>",
        errors: [{ messageId: "decorative" }],
      },
    ],
  })
})

for (const edition of ["lite", "full"]) {
  test(`R286: FE_ICON_INLINE_SVG requires an exported brand-mark leaf (${edition})`, () => {
    const settings = { starci: { hfs: fixtureHfs(undefined, { lite: edition === "lite" }) } }
    const brandLeaf = at(`${R}/leaves/AgentMark/index.tsx`)
    const svg = "<svg viewBox=\"0 0 24 24\"><path d=\"M0 0h24v24H0z\" /></svg>"
    const declared = `/** @brand-mark */\nexport const AgentMark = () => ${svg}`
    const entry = (filename, code) => ({ filename, code, settings })
    const refused = (filename, code) => ({ ...entry(filename, code), errors: [{ messageId: "inlineSvg" }] })
    tester.run("no-inline-svg-outside-brand-mark-leaf", noInlineSvgOutsideBrandMarkLeaf, {
      valid: [
        entry(brandLeaf, declared),
        entry(brandLeaf, `/**\n * The product's own wordmark.\n * @brand-mark\n */\nexport function AgentMark() { return ${svg} }`),
        entry(brandLeaf, `/** @brand-mark */\nexport default () => ${svg}`),
        entry(OTHER_LEAF, 'export const Link = () => <Icon props={{ name: "next" }} />'),
        entry(at("scripts/preview.tsx"), `const Preview = () => ${svg}`),
        ...(edition === "full" ? [entry(at("packages/nivo-ui/src/leaves/AgentMark/index.tsx"), declared)] : []),
      ],
      invalid: [
        refused(brandLeaf, `export const AgentMark = () => ${svg}`),
        refused(ICON_LEAF, `export const Icon = () => ${svg}`),
        refused(BLOCK, declared),
        refused(at(`${R}/composites/AgentMark/index.tsx`), declared),
        refused(at(`${R}/leaves/AgentMark/component.tsx`), declared),
        refused(NOT_A_LEAF, declared),
        refused(brandLeaf, `/** @brand-mark */\nconst unrelated = true\nexport const AgentMark = () => ${svg}`),
        refused(brandLeaf, `// @brand-mark\nexport const AgentMark = () => ${svg}`),
        refused(brandLeaf, `/** @brand-mark */\nconst AgentMark = () => ${svg}`),
        refused(brandLeaf, `export const AgentMark = () => { /** @brand-mark */ return ${svg} }`),
        refused(brandLeaf, `${declared}\nexport const OtherIcon = () => ${svg}`),
        refused(brandLeaf, `/** @brand-mark */\nexport const AgentMark = () => { const OtherIcon = () => ${svg}; return <OtherIcon /> }`),
        ...(edition === "full" ? [refused(at("packages/nivo-ui/src/composites/AgentMark/index.tsx"), declared)] : []),
      ],
    })
  })
}
