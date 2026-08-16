/**
 * Twin tests for the contract rules.
 *
 *   node --test contract.test.mjs
 *
 * SELF-CONTAINED ON PURPOSE. The rule that reads the table is tested against a fixture written to a
 * temporary directory rather than against whatever repository happens to hold this file, so the
 * suite proves the same thing wherever it is copied. A test that silently passes because the file
 * it was reading is absent is the exact failure these rules exist to prevent - and it has already
 * happened once in the source this was ported from.
 */
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  noInteractionClassInEntry,
  contractWhyIsAReason,
  noClassCompositionOutsideContract,
  noDuplicateEntryShape,
  noHandWrittenContractAttrs,
  noLiteralStructuralClass,
  noStructuralArrangementInLeaf,
  noStructuralHostOutsideContractFrame,
  noUnknownContractKey,
  noDeadContractKey,
  onlyTheFrameWearsANode,
  contractSearchRoots,
  readContracts,
  rules,
} from "./contract.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

/** A repository whose contract table declares exactly one key, built fresh for this run. */
const fixtureRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "starci-contract-")).replace(/\\/g, "/")
  mkdirSync(join(root, "src/components/contracts"), { recursive: true })
  writeFileSync(
    join(root, "src/components/contracts/index.ts"),
    [
      "export const CONTRACTS = buildContracts({",
      "    \"title-with-baseline-fact\": {",
      "        classNames: [\"flex\", \"items-baseline\", \"gap-3\"],",
      "        children: { title: { leaf: \"text\", props: { size: \"md\" } } },",
      "        why: \"the fact sits on the title baseline so a long title pushes it down rather than misaligning\",",
      "    },",
      "})",
      "",
      // A SECOND table in the same file. It is here so the reader cannot go back to slicing to EOF:
      // do that and this key is collected as a node key, and the rule accepts it where it must not.
      "export const UNRELATED = buildSomethingElse({",
      "    \"label-over-tile-grid\": {",
      "        classNames: [\"flex\", \"flex-col\", \"gap-4\"],",
      "        hidden: \"none\",",
      "        body: \"title-with-baseline-fact\",",
      "        why: \"the tiles are already surfaces, so another one around them nests two insets\",",
      "    },",
      "})",
      "",
    ].join("\n"),
    "utf8",
  )
  return root
}

const ROOT = fixtureRoot()
const BLOCK = `${ROOT}/src/components/blocks/dashboard/Example/index.tsx`
const COMPOSITE = `${ROOT}/src/components/composites/LabelledProgressRow/index.tsx`
const LEAF = `${ROOT}/src/components/leaves/Text/index.tsx`
const FRAME = `${ROOT}/src/components/branches/Tree/index.tsx`
const SURFACE = `${ROOT}/src/components/branches/SurfaceListCard/index.tsx`
const FORM_SURFACE = `${ROOT}/src/components/branches/SurfaceFormCard/index.tsx`
const TABLE = `${ROOT}/src/components/contracts/index.ts`

test("the path constant still finds a real entry table", () => {
  const contracts = readContracts(BLOCK)
  assert.ok(contracts, "the table above a source file must be readable - a null here silences every rule below")
  assert.deepEqual(contracts.keys, ["title-with-baseline-fact"])
})

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("CONTRACT-1: a structural class written as a literal goes back to a key", () => {
  tester.run("no-literal-structural-class", noLiteralStructuralClass, {
    valid: [
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"title-with-baseline-fact\" />" },
      { filename: BLOCK, code: "export const E = () => <Text className=\"text-sm\" />" },
      { filename: LEAF, code: "export const T = () => <p className=\"inline-flex items-center gap-2\" />" },
    ],
    invalid: [
      {
        filename: BLOCK,
        code: "export const E = () => <Tree className=\"flex gap-4\" />",
        errors: [{ messageId: "structural" }],
      },
      {
        // a composite is NOT exempt: the leaf folder is the only exemption, and widening it is
        // exactly how the leaf tier filled up with arrangements
        filename: COMPOSITE,
        code: "export const C = () => <div className=\"flex flex-col gap-2\" />",
        errors: [{ messageId: "structural" }],
      },
    ],
  })
})

test("CONTRACT-1: hoisting the string into a constant hides it rather than licensing it", () => {
  tester.run("no-literal-structural-class", noLiteralStructuralClass, {
    valid: [
      // not structural - a leaf's own look is none of this rule's business
      { filename: COMPOSITE, code: "const TONE = \"text-sm text-muted\"" },
      // the leaf folder is the one exemption, and it applies to the constant too
      { filename: LEAF, code: "const ROW = \"inline-flex items-center gap-2\"" },
      { filename: COMPOSITE, code: "const LABEL = `already resolved`" },
    ],
    invalid: [
      {
        // the exact shape that survived every rule in the source this was ported from
        filename: COMPOSITE,
        code: "const ROW_CLASSES = \"flex flex-row items-center gap-3 rounded-xl px-3 py-2\"",
        errors: [{ messageId: "hoisted" }],
      },
      {
        filename: BLOCK,
        code: "const SHELL = `flex flex-col gap-4`",
        errors: [{ messageId: "hoisted" }],
      },
    ],
  })
})

test("CONTRACT-2: a class string is never assembled at runtime", () => {
  tester.run("no-class-composition-outside-contract", noClassCompositionOutsideContract, {
    valid: [
      { filename: BLOCK, code: "export const E = () => <Tree contract={t ? \"rows-tight\" : \"rows\"} />" },
      { filename: LEAF, code: "export const T = () => <p className={cn(\"a\", \"b\")} />" },
    ],
    invalid: [
      {
        filename: BLOCK,
        code: "export const E = () => <Tree className={cn(\"flex\", on && \"gap-4\")} />",
        errors: [{ messageId: "composer" }],
      },
      {
        filename: BLOCK,
        code: "export const E = () => <Tree className={`flex ${extra}`} />",
        errors: [{ messageId: "interpolated" }],
      },
    ],
  })
})

test("CONTRACT-6: a reason that restates the key is not a reason", () => {
  tester.run("contract-why-is-a-reason", contractWhyIsAReason, {
    valid: [
      {
        filename: TABLE,
        code: "const C = { \"title-with-baseline-fact\": { why: \"the fact sits on the title baseline so a long title pushes it down rather than misaligning it\" } }",
      },
      { filename: BLOCK, code: "const C = { \"x\": { why: \"row of chips\" } }" },
    ],
    invalid: [
      {
        filename: TABLE,
        code: "const C = { \"content-row\": { why: \"row of chips\" } }",
        errors: [{ messageId: "tooShort" }],
      },
      {
        filename: TABLE,
        code: "const C = { \"title-with-baseline-fact\": { why: \"title with baseline fact title with baseline fact title with baseline fact\" } }",
        errors: [{ messageId: "restates" }],
      },
    ],
  })
})

test("CONTRACT-7: a structural host outside the frame is a node with no key", () => {
  tester.run("no-structural-host-outside-contract-frame", noStructuralHostOutsideContractFrame, {
    valid: [
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"title-with-baseline-fact\" />" },
      { filename: FRAME, code: "export const Tree = () => <div />" },
      { filename: FRAME, code: "export const Tree = () => <ul />" },
      { filename: SURFACE, code: "export const SurfaceListCard = () => <div className=\"flex flex-col gap-3\" />" },
      { filename: FORM_SURFACE, code: "export const SurfaceFormCard = () => <Card />" },
      { filename: LEAF, code: "export const T = () => <div />" },
      { filename: BLOCK, code: "export const E = () => <span />" },
      // a semantic element carrying MEANING and no shape: it decides nothing, and swapping it for
      // a neutral box would change what assistive technology reports
      { filename: BLOCK, code: "export const E = () => <form onSubmit={submit}><Tree contract=\"form-column\" /></form>" },
      { filename: COMPOSITE, code: "export const C = () => <ul><li /></ul>" },
    ],
    invalid: [
      { filename: BLOCK, code: "export const E = () => <div />", errors: [{ messageId: "host" }] },
      { filename: BLOCK, code: "export const E = () => <section />", errors: [{ messageId: "host" }] },
      // a semantic element the moment it carries a shape
      {
        filename: COMPOSITE,
        code: "export const C = () => <ul className=\"flex gap-2\" />",
        errors: [{ messageId: "styledSemantic" }],
      },
      {
        filename: BLOCK,
        code: "export const E = () => <form className=\"flex flex-col\" />",
        errors: [{ messageId: "styledSemantic" }],
      },
    ],
  })
})

test("CONTRACT-7B: a leaf owns one atomic host, not a structural arrangement", () => {
  tester.run("no-structural-arrangement-in-leaf", noStructuralArrangementInLeaf, {
    valid: [
      { filename: LEAF, code: "export const T = () => <div />" },
      { filename: LEAF, code: "export const T = () => <button><span>Buy</span><Icon /></button>" },
      { filename: LEAF, code: "export const T = ({ list }) => list ? <ul /> : <section />" },
      { filename: BLOCK, code: "export const B = () => <div><div /></div>" },
    ],
    invalid: [
      {
        filename: LEAF,
        code: "export const T = () => <div><div /></div>",
        errors: [{ messageId: "arrangement" }],
      },
      {
        filename: LEAF,
        code: "export const T = () => <div><ul /></div>",
        errors: [{ messageId: "arrangement" }],
      },
      {
        filename: LEAF,
        code: "export const T = () => <ul><li /></ul>",
        errors: [{ messageId: "arrangement" }],
      },
      {
        filename: LEAF,
        code: "export const T = () => <><div /><section /></>",
        errors: [{ messageId: "arrangement" }],
      },
      {
        filename: LEAF,
        code: "export const T = () => <Vendor><div /><section /></Vendor>",
        errors: [{ messageId: "arrangement" }],
      },
      {
        filename: LEAF,
        code: "const Box = 'div'; export const T = () => <Box><section /></Box>",
        errors: [{ messageId: "arrangement" }],
      },
      {
        filename: LEAF,
        code: "export const T = defineLeafComponent({ render: () => <div><section /></div> })",
        errors: [{ messageId: "arrangement" }],
      },
    ],
  })
})

test("CONTRACT-8: a marker written by hand claims a contract nothing holds", () => {
  tester.run("no-hand-written-contract-attrs", noHandWrittenContractAttrs, {
    valid: [
      { filename: FRAME, code: "export const Tree = () => <div data-node=\"x\" />" },
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"title-with-baseline-fact\" />" },
    ],
    invalid: [
      {
        filename: BLOCK,
        code: "export const E = () => <Tree data-node=\"title-with-baseline-fact\" />",
        errors: [{ messageId: "marker" }],
      },
    ],
  })
})

test("CONTRACT-9: an unknown key describes nothing, and the message lists the real ones", () => {
  tester.run("no-unknown-contract-key", noUnknownContractKey, {
    valid: [{ filename: BLOCK, code: "export const E = () => <Tree contract=\"title-with-baseline-fact\" />" }],
    invalid: [
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"card\" />", errors: [{ messageId: "unknown" }] },
      { filename: BLOCK, code: "const spec = contractSpec(\"card\")", errors: [{ messageId: "unknown" }] },
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"label-over-tile-grid\" />", errors: [{ messageId: "unknown" }] },
    ],
  })
})

/** One entry table, written the way the real one is: the entries inside a `buildContracts` call. */
const contractTable = (...entries) => ["const CONTRACTS = buildContracts({", ...entries, "})"].join("\n")

/** The two joined lists that look alike and are not: same classes, different row. */
const JOINED_LIST_CLASSES = "[\"overflow-hidden\", \"divide-y\", \"divide-separator\", \"p-0\"]"
const DAILY_QUEST_LIST =
  `    "daily-quest-list": { classes: ${JOINED_LIST_CLASSES}, children: { task: { composite: "task-progress-row", repeats: true, restingCount: 5 } }, why: "..." },`
const UPCOMING_LIVESTREAM_LIST =
  `    "upcoming-livestream-list": { classes: ${JOINED_LIST_CLASSES}, children: { session: { composite: "upcoming-livestream-row", repeats: true, restingCount: 3 } }, why: "..." },`

test("CONTRACT-12: an entry states the arrangement, never how the node reacts, is painted or is raised", () => {
  tester.run("no-interaction-class-in-entry", noInteractionClassInEntry, {
    valid: [
      // Arrangement, all of it: how the children of one node stand together.
      { filename: TABLE, code: contractTable('    "row": { classes: ["flex", "flex-row", "items-center", "gap-3", "min-w-0", "grow"], children: {}, why: "..." },') },
      // A joined list separates its rows with a rule; that is the relationship, not the paint.
      { filename: TABLE, code: contractTable('    "list": { classes: ["divide-y", "divide-separator", "p-0"], children: {}, why: "..." },') },
      // Alignment is arrangement: it says how the content of every child sits, which is the same
      // kind of statement as `items-center` and is what a container is for.
      { filename: TABLE, code: contractTable('    "notice": { classes: ["flex", "flex-col", "items-center", "text-center"], children: {}, why: "..." },') },
      // The app frame's own ground. Chrome that no card branch owns has to draw the page it sits
      // on, and nothing about it is raised.
      { filename: TABLE, code: contractTable('    "navbar": { classes: ["sticky", "top-0", "z-50", "w-full", "border-b", "border-separator", "bg-background"], children: {}, why: "..." },') },
      // An edge clips and divides as well as cornering an object, so it is left to the migration:
      // these are the joined-list corners and the band rule, not a card.
      { filename: TABLE, code: contractTable('    "joined-list": { classes: ["overflow-hidden", "rounded-2xl", "border", "border-separator", "divide-y", "divide-separator"], children: {}, why: "..." },') },
      // A full-bleed band keeps its ground. It takes the whole measure and rules itself off from the
      // next band, because it has no boundary of its own to do it with - which is a landing page
      // counting its sections, not a card, and no surface branch draws it.
      { filename: TABLE, code: contractTable('    "band": { classes: ["w-full", "border-b", "border-separator", "px-6", "py-6", "bg-surface"], children: {}, why: "..." },') },
      // The same offending class outside the table is somebody else's rule to enforce.
      { filename: `${ROOT}/src/components/branches/PressableSurface/index.tsx`, code: 'const CLASSES = "cursor-pointer active:opacity-70"' },
    ],
    invalid: [
      {
        filename: TABLE,
        code: contractTable('    "row": { classes: ["flex", "cursor-pointer"], children: {}, why: "..." },'),
        errors: [{ messageId: "interaction", data: { key: "row", value: "cursor-pointer" } }],
      },
      {
        filename: TABLE,
        code: contractTable('    "row": { classes: ["flex", "hover:opacity-80"], children: {}, why: "..." },'),
        errors: [{ messageId: "interaction" }],
      },
      {
        filename: TABLE,
        code: contractTable('    "row": { classes: ["flex", "active:opacity-70"], children: {}, why: "..." },'),
        errors: [{ messageId: "interaction" }],
      },
      {
        filename: TABLE,
        code: contractTable('    "row": { classes: ["flex", "group"], children: {}, why: "..." },'),
        errors: [{ messageId: "interaction" }],
      },
      {
        filename: TABLE,
        code: contractTable('    "row": { classes: ["flex", "text-foreground"], children: {}, why: "..." },'),
        errors: [{ messageId: "paint", data: { key: "row", value: "text-foreground" } }],
      },
      // A ground of its own: the node has become the card the surface branch already draws.
      {
        filename: TABLE,
        code: contractTable('    "tile": { classes: ["flex", "flex-col", "gap-3", "p-4", "bg-surface"], children: {}, why: "..." },'),
        errors: [{ messageId: "raised", data: { key: "tile", value: "bg-surface" } }],
      },
      // The same claim with a tone on it - the family is refused, not the one token.
      {
        filename: TABLE,
        code: contractTable('    "tile": { classes: ["flex", "bg-surface-raised"], children: {}, why: "..." },'),
        errors: [{ messageId: "raised", data: { key: "tile", value: "bg-surface-raised" } }],
      },
      // An elevation of its own, whichever name the shadow carries.
      {
        filename: TABLE,
        code: contractTable('    "tile": { classes: ["flex", "shadow-surface"], children: {}, why: "..." },'),
        errors: [{ messageId: "raised", data: { key: "tile", value: "shadow-surface" } }],
      },
      {
        filename: TABLE,
        code: contractTable('    "tile": { classes: ["flex", "shadow-lg"], children: {}, why: "..." },'),
        errors: [{ messageId: "raised", data: { key: "tile", value: "shadow-lg" } }],
      },
      // The real entry, reported on both halves of the same claim.
      {
        filename: TABLE,
        code: contractTable('    "label-over-figure-tile": { classes: ["flex", "flex-col", "gap-3", "p-4", "rounded-2xl", "bg-surface", "shadow-surface"], children: {}, why: "..." },'),
        errors: [
          { messageId: "raised", data: { key: "label-over-figure-tile", value: "bg-surface" } },
          { messageId: "raised", data: { key: "label-over-figure-tile", value: "shadow-surface" } },
        ],
      },
    ],
  })
})

test("CONTRACT-9: an entry whose shape another entry already spells is that entry under a second name", () => {
  tester.run("no-duplicate-entry-shape", noDuplicateEntryShape, {
    valid: [
      // The real pair. The classes are identical to the byte and the rows are not the same row, so
      // the two lists are two shapes and calling them one would erase a distinction that renders.
      { filename: TABLE, code: contractTable(DAILY_QUEST_LIST, UPCOMING_LIVESTREAM_LIST) },
      {
        // The same distinction with the slot NAME held constant, so only the identity differs.
        filename: TABLE,
        code: contractTable(
          "    \"quest-list\": { classes: [\"divide-y\"], children: { row: { composite: \"task-progress-row\", repeats: true } }, why: \"...\" },",
          "    \"session-list\": { classes: [\"divide-y\"], children: { row: { composite: \"upcoming-livestream-row\", repeats: true } }, why: \"...\" },",
        ),
      },
      {
        // One slot may be left out and the other may not, so the two entries promise different things.
        filename: TABLE,
        code: contractTable(
          "    \"avatar-over-name-column\": { classes: [\"flex\", \"flex-col\", \"gap-2\"], children: { mark: { leaf: \"avatar\" }, name: { leaf: \"text\" } }, why: \"...\" },",
          "    \"badge-over-title-column\": { classes: [\"flex\", \"flex-col\", \"gap-2\"], children: { mark: { leaf: \"avatar\", optional: true }, name: { leaf: \"text\" } }, why: \"...\" },",
        ),
      },
      {
        // One entry names its element and the other does not. Naming it is a decision the entry
        // took, so the pair is never called a copy.
        filename: TABLE,
        code: contractTable(
          "    \"weekday-run\": { classes: [\"flex\", \"gap-2\"], host: \"ul\", why: \"...\" },",
          "    \"chip-run\": { classes: [\"flex\", \"gap-2\"], why: \"...\" },",
        ),
      },
      {
        // Not the table: this file writes no entries, whatever the object in it looks like.
        filename: BLOCK,
        code: contractTable(
          "    \"label-over-value-column\": { classes: [\"flex\", \"flex-col\", \"gap-2\"], children: { label: { leaf: \"text\" } }, why: \"...\" },",
          "    \"caption-over-figure-column\": { classes: [\"flex\", \"flex-col\", \"gap-2\"], children: { label: { leaf: \"text\" } }, why: \"...\" },",
        ),
      },
    ],
    invalid: [
      {
        // Same classes, same slot holding the same thing: one shape wearing two names, reported
        // once - on the later entry, which is the one that has somewhere to go back to.
        filename: TABLE,
        code: contractTable(
          "    \"label-over-value-column\": { classes: [\"flex\", \"flex-col\", \"gap-2\"], children: { label: { leaf: \"text\" } }, why: \"...\" },",
          "    \"caption-over-figure-column\": { classes: [\"flex\", \"flex-col\", \"gap-2\"], children: { label: { leaf: \"text\" } }, why: \"...\" },",
        ),
        errors: [
          {
            messageId: "duplicate",
            data: { key: "caption-over-figure-column", other: "label-over-value-column" },
          },
        ],
      },
      {
        // The order the classes were typed in is not a decision the node takes.
        filename: TABLE,
        code: contractTable(
          "    \"title-over-fact-column\": { classes: [\"flex\", \"flex-col\", \"gap-3\"], children: { title: { leaf: \"text\" } }, why: \"...\" },",
          "    \"fact-under-title-column\": { classes: [\"gap-3\", \"flex-col\", \"flex\"], children: { title: { leaf: \"text\" } }, why: \"...\" },",
        ),
        errors: [{ messageId: "duplicate", data: { key: "fact-under-title-column", other: "title-over-fact-column" } }],
      },
      {
        // A different placeholder count is the same widening CONTRACT-9 refuses for a different gap,
        // and a literal constraint on a leaf is not the shape the slot holds either.
        filename: TABLE,
        code: contractTable(
          "    \"quest-list\": { classes: [\"divide-y\"], children: { row: { composite: \"task-progress-row\", repeats: true, restingCount: 5 } }, why: \"...\" },",
          "    \"short-quest-list\": { classes: [\"divide-y\"], children: { row: { composite: \"task-progress-row\", repeats: true, restingCount: 3 } }, why: \"...\" },",
        ),
        errors: [{ messageId: "duplicate", data: { key: "short-quest-list", other: "quest-list" } }],
      },
      {
        filename: TABLE,
        code: contractTable(
          "    \"name-over-handle\": { classes: [\"flex\", \"flex-col\"], children: { name: { leaf: \"text\", props: { size: \"sm\" } } }, why: \"...\" },",
          "    \"title-over-handle\": { classes: [\"flex\", \"flex-col\"], children: { name: { leaf: \"text\", props: { size: \"lg\" } } }, why: \"...\" },",
        ),
        errors: [{ messageId: "duplicate", data: { key: "title-over-handle", other: "name-over-handle" } }],
      },
    ],
  })
})

test("CONTRACT-4: an entry's node is worn by the frame and by nothing else", () => {
  tester.run("only-the-frame-wears-a-node", onlyTheFrameWearsANode, {
    valid: [
      // The frame is what the helper exists for: it holds the entry's element AND its props together.
      { filename: FRAME, code: "const p = contractNodeProps(\"title-with-baseline-fact\")" },
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"title-with-baseline-fact\" />" },
      // A surface branch the way they are written now: the vendor wrapper is its own, and the
      // entry's node is RENDERED inside it rather than spread onto the body.
      {
        filename: SURFACE,
        code: "export const S = () => <Card><Card.Content><Tree contract=\"title-with-baseline-fact\" render={r} /></Card.Content></Card>",
      },
      // Not product source: a script that reads the vocabulary draws nothing.
      { filename: `${ROOT}/scripts/report.mjs`, code: "const p = contractNodeProps(\"title-with-baseline-fact\")" },
    ],
    invalid: [
      // The live shape this rule was written for: a named surface branch wearing somebody else's
      // node on a box of its own, with every visible sign of the contract exactly where a reader
      // expects it.
      {
        filename: SURFACE,
        code: "export const S = () => <div {...contractNodeProps(\"label-row-over-card\")} />",
        errors: [{ messageId: "worn" }],
      },
      {
        filename: COMPOSITE,
        code: "const props = contractNodeProps(\"title-with-baseline-fact\")",
        errors: [{ messageId: "worn" }],
      },
      // Reaching it through the module it lives in is the same call under a longer name.
      {
        filename: SURFACE,
        code: "export const S = () => <Card.Content {...contracts.contractNodeProps(\"label-row-over-card\")} />",
        errors: [{ messageId: "worn" }],
      },
    ],
  })
})

/**
 * A repository whose keys are used the four ways a key is used, and one that is used no way at all.
 *
 * The stale copies are written on purpose. A candidate under `.artifacts` and a vendored copy under
 * `node_modules` both name `ghost-column`, and neither is a call site - a key kept alive by a
 * directory holding copies of source is exactly the dead key this rule exists to find.
 */
const usageRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "starci-usage-")).replace(/\\/g, "/")
  const write = (relative, text) => {
    mkdirSync(join(root, relative, ".."), { recursive: true })
    writeFileSync(join(root, relative), text, "utf8")
  }
  write(
    "src/components/contracts/index.ts",
    "export const CONTRACTS = buildContracts({\n    \"figure-over-label-column\": { classes: [\"flex\"], why: \"...\" },\n})\n",
  )
  write(
    "src/components/blocks/Rendered/index.tsx",
    "export const R = () => <Tree contract=\"figure-over-label-column\" render={r} />\n",
  )
  write(
    "src/components/blocks/Rendered/component.stories.tsx",
    "export const Resting = { render: () => defineContractComponent(\"empty-state-notice\", {}) }\n",
  )
  write(
    "src/components/blocks/Rendered/component.test.tsx",
    "const COUNT = CONTRACTS[\"ranked-user-list\"].children.user.restingCount\n",
  )
  // A component that picks between sibling entries and hands the frame a variable. The key is
  // written where the choice is made, which is nowhere near the word `contract`.
  write(
    "src/components/composites/PickedRow/index.tsx",
    [
      "import type { ContractKey } from \"@/components/contracts\"",
      "const contractFor = (verdict?: string): ContractKey => {",
      "    if (verdict === \"success\") return \"verdict-success-row\"",
      "    return \"plain-verdict-row\"",
      "}",
      "export const R = ({ verdict }) => <Tree contract={contractFor(verdict)} render={r} />",
      "",
    ].join("\n"),
  )
  write(
    "src/app/[lang]/dashboard/layout.tsx",
    "const body = defineContractProjection(\"routed-page-main\", () => <Page />)\n",
  )
  write("src/components/blocks/Rendered/node_modules/stale/index.js", "const E = () => <Tree contract=\"ghost-column\" />\n")
  write("src/.artifacts/design-plan/candidate/src/x.tsx", "const E = () => <Tree contract=\"ghost-column\" />\n")
  return root
}

const USAGE_ROOT = usageRoot()
const USAGE_TABLE = `${USAGE_ROOT}/src/components/contracts/index.ts`
/** The roots the message names, computed the way the rule computes them. */
const USAGE_ROOTS = contractSearchRoots(USAGE_TABLE).join(", ")

test("CONTRACT-13: the search roots are the trees a call site can be written in, walked once", () => {
  assert.deepEqual(contractSearchRoots(USAGE_TABLE), [`${USAGE_ROOT}/src`])
  assert.deepEqual(contractSearchRoots(`${USAGE_ROOT}/src/components/blocks/Rendered/index.tsx`), [])
})

test("CONTRACT-13: a key nothing renders is a promise about a node that does not exist", () => {
  tester.run("no-dead-contract-key", noDeadContractKey, {
    valid: [
      // Rendered by the frame at a call site.
      { filename: USAGE_TABLE, code: contractTable('    "figure-over-label-column": { classes: ["flex"], why: "..." },') },
      // Rendered ONLY as a slot of another entry. The only file naming it is the one file the walk
      // skips, so a reader that asked the tree alone would call a drawn node dead.
      {
        filename: USAGE_TABLE,
        code: contractTable(
          '    "figure-over-label-column": { classes: ["flex"], children: { fact: { contract: "counted-fact-line" } }, why: "..." },',
          '    "counted-fact-line": { classes: ["flex", "items-baseline"], why: "..." },',
        ),
      },
      // A slot holding alternatives draws whichever it is handed, so both are alive.
      {
        filename: USAGE_TABLE,
        code: contractTable(
          '    "figure-over-label-column": { classes: ["flex"], children: { fact: { contract: ["counted-fact-line", "empty-fact-line"] } }, why: "..." },',
          '    "counted-fact-line": { classes: ["flex"], why: "..." },',
          '    "empty-fact-line": { classes: ["flex"], why: "..." },',
        ),
      },
      // Proven in Storybook and nowhere else: documented, not dead.
      { filename: USAGE_TABLE, code: contractTable('    "empty-state-notice": { classes: ["flex"], why: "..." },') },
      // Named only by a test, which renders it exactly like any other call site.
      { filename: USAGE_TABLE, code: contractTable('    "ranked-user-list": { classes: ["divide-y"], why: "..." },') },
      // A route projection is a call site too, and it lives outside the component folder.
      { filename: USAGE_TABLE, code: contractTable('    "routed-page-main": { classes: ["flex"], host: "main", why: "..." },') },
      // Chosen by a helper typed `ContractKey` and handed to the frame as a variable, which is how
      // sibling entries are picked between and is nowhere near the word `contract`.
      {
        filename: USAGE_TABLE,
        code: contractTable(
          '    "verdict-success-row": { classes: ["flex"], why: "..." },',
          '    "plain-verdict-row": { classes: ["flex"], why: "..." },',
        ),
      },
      // Not the table: a file that writes no vocabulary owns no keys to delete.
      { filename: BLOCK, code: contractTable('    "ghost-column": { classes: ["flex"], why: "..." },') },
      // A candidate's table is a plan record: it copies the vocabulary and draws the one page it
      // was built to answer, and an unbuilt shape is exactly what a reader expects to find there.
      {
        filename: `${USAGE_ROOT}/.artifacts/design-plan/x/candidate/src/components/contracts/index.ts`,
        code: contractTable('    "ghost-column": { classes: ["flex"], why: "..." },'),
      },
    ],
    invalid: [
      {
        // Named only inside `node_modules` and `.artifacts`, which hold copies of source rather
        // than source.
        filename: USAGE_TABLE,
        code: contractTable('    "ghost-column": { classes: ["flex"], why: "..." },'),
        errors: [{ messageId: "dead", data: { key: "ghost-column", roots: USAGE_ROOTS } }],
      },
      {
        // One alive key beside one nobody names, so the report is the key and not the table.
        filename: USAGE_TABLE,
        code: contractTable(
          '    "figure-over-label-column": { classes: ["flex"], why: "..." },',
          '    "planned-timeline-column": { classes: ["flex", "flex-col"], why: "..." },',
        ),
        errors: [{ messageId: "dead", data: { key: "planned-timeline-column", roots: USAGE_ROOTS } }],
      },
    ],
  })
})

test("CONTRACT-13: a reader that cannot see the tree stays quiet rather than emptying the table", () => {
  const orphan = mkdtempSync(join(tmpdir(), "starci-blind-")).replace(/\\/g, "/")
  const table = `${orphan}/src/components/contracts/index.ts`
  assert.deepEqual(contractSearchRoots(table), [], "no tree on disk means nothing to walk")
  tester.run("no-dead-contract-key", noDeadContractKey, {
    valid: [{ filename: table, code: contractTable('    "planned-timeline-column": { classes: ["flex"], why: "..." },') }],
    invalid: [],
  })
})

test("a table that cannot be read silences the rule instead of failing every call site", () => {
  const orphan = mkdtempSync(join(tmpdir(), "starci-orphan-")).replace(/\\/g, "/")
  assert.equal(readContracts(`${orphan}/src/components/blocks/x/Y/index.tsx`), null)
  tester.run("no-unknown-contract-key", noUnknownContractKey, {
    valid: [
      { filename: `${orphan}/src/components/blocks/x/Y/index.tsx`, code: "const E = () => <Tree contract=\"anything\" />" },
    ],
    invalid: [],
  })
})
