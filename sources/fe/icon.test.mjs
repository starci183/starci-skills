/**
 * Twin tests for the icon rules.
 *
 *   node --test icon.test.mjs
 *
 * The case that matters most is the SUBPATH one. The original escape imported a vendor subpath,
 * and a check comparing a package name for equality does not see it - so that case is asserted
 * first and must never be deleted to make an import tidier.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { heroiconsIsTheGlyphVendor, noOffScaleGlyphSize, noVendorIconOutsideIconLeaf, rules } from "./icon.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const R = "D:/repo/src/components"
const ICON_LEAF = `${R}/leaves/Icon/index.tsx`
const ICON_LEAF_BRANDS = `${R}/leaves/Icon/brands.tsx`
const OTHER_LEAF = `${R}/leaves/SeeMoreLink/index.tsx`
const BLOCK = `${R}/blocks/dashboard/DailyQuest/component.tsx`
const ICON_LAW = readFileSync(new URL("../../fe/canon/patterns/icon.md", import.meta.url), "utf8")
const MAPPING_TABLE = ICON_LAW.match(/\| Meaning \(`IconName`\)[\s\S]*?(?=\n## Forbidden)/)?.[0] ?? ""
const MAPPING_ROWS = Array.from(
  MAPPING_TABLE.matchAll(/^\| `(\w+)` \| [^|]+ \| `(\w+)` \|$/gm),
  (match) => ({ meaning: match[1], glyph: match[2] }),
)

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("ICON-6: the icon leaf owns the library, and a subpath does not walk around it", () => {
  tester.run("no-vendor-icon-outside-icon-leaf", noVendorIconOutsideIconLeaf, {
    valid: [
      { filename: ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react/24/outline\"" },
      // a second file INSIDE the leaf folder is still the leaf
      { filename: ICON_LEAF_BRANDS, code: "import type { SVGProps } from \"react\"" },
      { filename: OTHER_LEAF, code: "import { Icon } from \"@/components/leaves/Icon\"" },
      { filename: BLOCK, code: "import { Link as HeroLink } from \"@heroui/react\"" },
      // tooling is out of scope
      { filename: "D:/repo/scripts/build.ts", code: "import { X } from \"lucide-react\"" },
    ],
    invalid: [
      {
        // the exact escape these rules were written for
        filename: OTHER_LEAF,
        code: "import { CaretRightIcon } from \"@phosphor-icons/react/dist/ssr\"",
        errors: [{ messageId: "vendor" }],
      },
      {
        filename: OTHER_LEAF,
        code: "import { CaretRightIcon } from \"@phosphor-icons/react\"",
        errors: [{ messageId: "vendor" }],
      },
      { filename: BLOCK, code: "import { Star } from \"lucide-react\"", errors: [{ messageId: "vendor" }] },
      { filename: BLOCK, code: "import { FaBeer } from \"react-icons/fa\"", errors: [{ messageId: "vendor" }] },
      {
        filename: ICON_LEAF_BRANDS,
        code: "import { GoogleIcon } from \"@heroicons/react/24/outline\"",
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

test("ICON-9: the canon feature map gives every meaning unique glyph ownership", () => {
  assert.ok(MAPPING_ROWS.length > 0, "icon.md has no readable feature mapping rows")
  assert.equal(new Set(MAPPING_ROWS.map(({ meaning }) => meaning)).size, MAPPING_ROWS.length)
  assert.equal(new Set(MAPPING_ROWS.map(({ glyph }) => glyph)).size, MAPPING_ROWS.length)
})

test("ICON-7: only the Heroicons outline and micro families may supply glyphs", () => {
  tester.run("heroicons-is-the-glyph-vendor", heroiconsIsTheGlyphVendor, {
    valid: [
      { filename: ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react/24/outline\"" },
      { filename: ICON_LEAF, code: "import { FireIcon } from \"@heroicons/react/16/solid\"" },
      { filename: ICON_LEAF_BRANDS, code: "import type { SVGProps } from \"react\"" },
      { filename: "D:/repo/scripts/build.ts", code: "import { X } from \"lucide-react\"" },
    ],
    invalid: [
      {
        filename: ICON_LEAF,
        code: "import { FireIcon } from \"@phosphor-icons/react\"",
        errors: [{ messageId: "vendor" }],
      },
      {
        filename: ICON_LEAF,
        code: "import { Flame } from \"lucide-react\"",
        errors: [{ messageId: "vendor" }],
      },
      {
        filename: ICON_LEAF,
        code: "import { FireIcon } from \"@heroicons/react/20/solid\"",
        errors: [{ messageId: "vendor" }],
      },
      {
        filename: ICON_LEAF,
        code: "import { FireIcon } from \"@heroicons/react/24/solid\"",
        errors: [{ messageId: "vendor" }],
      },
    ],
  })
})

test("ICON-1: a glyph size off both steps is a third step", () => {
  tester.run("no-off-scale-glyph-size", noOffScaleGlyphSize, {
    valid: [
      { filename: OTHER_LEAF, code: "const C = \"size-4 shrink-0\"" },
      { filename: OTHER_LEAF, code: "const C = \"size-5 shrink-0\"" },
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
