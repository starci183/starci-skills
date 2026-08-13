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
import {
  heroiconsIsTheGlyphVendor,
  noDecorativeIconInMetricCell,
  noOffScaleGlyphSize,
  noVendorIconOutsideIconLeaf,
  rankArtworkIsAClosedSet,
  rules,
} from "./icon.mjs"

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
const METRIC_CELL = `${R}/composites/LabelledProgressRow/index.tsx`
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

test("ICON-10: a repeated metric cell does not invent a decorative feature glyph", () => {
  tester.run("no-decorative-icon-in-metric-cell", noDecorativeIconInMetricCell, {
    valid: [
      {
        filename: METRIC_CELL,
        code: "const Row = () => <div><Text props={{ content: 'Content' }} /></div>",
      },
      {
        filename: BLOCK,
        code: "const Entry = () => <Icon props={{ name: 'course' }} />",
      },
    ],
    invalid: [
      {
        filename: METRIC_CELL,
        code: "const Row = () => <div><Icon props={{ name: 'course' }} /><Text /></div>",
        errors: [{ messageId: "decorative" }],
      },
    ],
  })
})

const RANK_LEAF = `${R}/leaves/RankMark/index.tsx`

test("ICON-11: the rank leaf may import its award artwork, and no other file may", () => {
  tester.run("no-vendor-icon-outside-icon-leaf", noVendorIconOutsideIconLeaf, {
    valid: [{ filename: RANK_LEAF, code: "import { Icon } from '@iconify/react'" }],
    invalid: [
      {
        filename: BLOCK,
        code: "import { Icon } from '@iconify/react'",
        errors: [{ messageId: "vendor" }],
      },
      {
        // The exemption is one PACKAGE, not one folder: the rank leaf reaching for a
        // second catalogue is the same escape wearing an approved filename.
        filename: RANK_LEAF,
        code: "import { Trophy } from '@phosphor-icons/react'",
        errors: [{ messageId: "vendor" }],
      },
    ],
  })
  tester.run("heroicons-is-the-glyph-vendor", heroiconsIsTheGlyphVendor, {
    valid: [{ filename: RANK_LEAF, code: "import { Icon } from '@iconify/react'" }],
    invalid: [
      {
        filename: OTHER_LEAF,
        code: "import { Icon } from '@iconify/react'",
        errors: [{ messageId: "vendor" }],
      },
    ],
  })
})

test("ICON-11: the award vocabulary is four artworks, closed", () => {
  tester.run("rank-artwork-is-a-closed-set", rankArtworkIsAClosedSet, {
    valid: [
      {
        filename: RANK_LEAF,
        code: "const PLACES = { 1: 'fluent-emoji-flat:1st-place-medal', 2: 'fluent-emoji-flat:2nd-place-medal', 3: 'fluent-emoji-flat:3rd-place-medal' }",
      },
      { filename: RANK_LEAF, code: "const FALLBACK = 'fluent-emoji-flat:trophy'" },
      // A file naming no award artwork at all is simply not this rule's business.
      { filename: BLOCK, code: "const label = 'first place'" },
      // The twin test of the rank leaf has to name the whole map to prove it is closed.
      {
        filename: `${R}/leaves/RankMark/index.test.tsx`,
        code: "const cases = ['fluent-emoji-flat:1st-place-medal', 'fluent-emoji-flat:4th-place-medal']",
      },
    ],
    invalid: [
      {
        // A fifth medal is a decision about what a PLACE means, and it is made in the law.
        filename: RANK_LEAF,
        code: "const FOURTH = 'fluent-emoji-flat:4th-place-medal'",
        errors: [{ messageId: "unknown" }],
      },
      {
        // An approved id in an unapproved file still splits the map in two.
        filename: BLOCK,
        code: "const mine = 'fluent-emoji-flat:trophy'",
        errors: [{ messageId: "outside" }],
      },
    ],
  })
})
