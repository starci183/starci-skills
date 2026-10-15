// proves: FE_SIZE_AND_STATE_BUDGET@lite
// proves: FE_SIZE_AND_STATE_BUDGET@full
// proves: FE_LIST_KEY@lite
// proves: FE_LIST_KEY@full
// proves: FE_EFFECT_CLEANUP@lite
// proves: FE_EFFECT_CLEANUP@full
// proves: FE_SWALLOWED_ERROR@lite
// proves: FE_SWALLOWED_ERROR@full
// proves: FE_CONSOLE_CALL@lite
// proves: FE_CONSOLE_CALL@full
import assert from "node:assert/strict"
import test from "node:test"
import {
  FE_DECLARATION,
  LITE_FE_DECLARATION,
  at,
  fixtureHfs,
  typedTester,
} from "./fixtures/typed/tester.mjs"
import { effectSubscriptionNeedsCleanup, noConsole, noEmptyCatch } from "./hygiene.mjs"
import { listItemHasKey, noIndexKey, noInlineLiteralPropInList } from "./lists.mjs"
import { componentLineBudget, noHandRolledPolling, unitHookBudget } from "./size-and-state-budget.mjs"

const BLOCK = at("apps/web/src/components/blocks/Feed/index.tsx")
const lines = (count) => Array.from({ length: count }, (_, index) => "const line" + index + " = " + index).join("\n")
const unit = (states, data) => "export const Feed = () => {\n"
  + Array.from({ length: states }, (_, index) => "const [state" + index + "] = useState(0)").join("\n") + "\n"
  + Array.from({ length: data }, (_, index) => "const data" + index + " = useQueryFeed" + index + "Swr()").join("\n")
  + "\nreturn null\n}"

for (const edition of ["lite", "full"]) {
  const lite = edition === "lite"
  const declaration = lite ? LITE_FE_DECLARATION : FE_DECLARATION
  const tester = typedTester({ declaration, lite })

  test(edition + " R65 uses the real edition's component slot", () => {
    const hfs = fixtureHfs(declaration, { lite })
    assert.equal(hfs.edition, edition)
    assert.equal(hfs.slot("fe.components").budget["index.tsx"], 200)
  })

  test(edition + " R65 accepts valid and rejects invalid component line budgets", () => {
    tester.run("component-line-budget", componentLineBudget, {
      valid: [{ filename: BLOCK, code: lines(200) }],
      invalid: [{ filename: BLOCK, code: lines(201), errors: [{ messageId: "lines", data: { count: 201, max: 200 } }] }],
    })
  })

  test(edition + " R65 accepts valid and rejects invalid state and data hook budgets", () => {
    tester.run("unit-hook-budget", unitHookBudget, {
      valid: [{ filename: BLOCK, code: unit(6, 6) }],
      invalid: [
        { filename: BLOCK, code: unit(7, 0), errors: [{ messageId: "state" }] },
        { filename: BLOCK, code: unit(0, 7), errors: [{ messageId: "data" }] },
      ],
    })
  })

  test(edition + " R65 accepts valid refresh hooks and rejects invalid polling loops", () => {
    tester.run("no-hand-rolled-polling", noHandRolledPolling, {
      valid: [{
        filename: BLOCK,
        code: "declare const useQueryFeedSwr: (options: object) => unknown\nconst Feed = () => useQueryFeedSwr({ refreshInterval: 5000 })",
      }],
      invalid: [
        {
          filename: BLOCK,
          code: "declare const load: () => Promise<void>\nsetInterval(() => { void load() }, 5000)",
          errors: [{ messageId: "interval" }],
        },
        {
          filename: BLOCK,
          code: "declare const load: () => Promise<void>\nfunction poll() { setTimeout(() => { void load(); poll() }, 3000) }",
          errors: [{ messageId: "timeout" }],
        },
      ],
    })
  })

  test(edition + " R65 accepts valid keyed lists and rejects invalid unkeyed lists", () => {
    tester.run("list-item-has-key", listItemHasKey, {
      valid: [{ filename: BLOCK, code: "const Feed = () => rows.map((row) => <Row key={row.id} row={row} />)" }],
      invalid: [{ filename: BLOCK, code: "const Feed = () => rows.map((row) => <Row row={row} />)", errors: [{ messageId: "missing" }] }],
    })
  })

  test(edition + " R65 accepts valid stable keys and rejects invalid index keys", () => {
    tester.run("no-index-key", noIndexKey, {
      valid: [{ filename: BLOCK, code: "const Feed = () => rows.map((row, index) => <Row key={row.id} row={row} position={index} />)" }],
      invalid: [{ filename: BLOCK, code: "const Feed = () => rows.map((row, index) => <Row key={index} row={row} />)", errors: [{ messageId: "index" }] }],
    })
  })

  test(edition + " R65 accepts valid stable props and rejects invalid list literal props", () => {
    tester.run("no-inline-literal-prop-in-list", noInlineLiteralPropInList, {
      valid: [{ filename: BLOCK, code: "const Feed = () => rows.map((row) => <Row key={row.id} row={row} options={options} />)" }],
      invalid: [{ filename: BLOCK, code: "const Feed = () => rows.map((row) => <Row key={row.id} options={{ dense: true }} />)", errors: [{ messageId: "literal" }] }],
    })
  })

  test(edition + " R65 accepts valid released effects and rejects invalid unreleased effects", () => {
    tester.run("effect-subscription-needs-cleanup", effectSubscriptionNeedsCleanup, {
      valid: [{
        filename: BLOCK,
        code: "import { useEffect } from 'react'\nuseEffect(() => { const timer = setTimeout(() => undefined, 300); return () => clearTimeout(timer) }, [])",
      }],
      invalid: [{
        filename: BLOCK,
        code: "import { useEffect } from 'react'\nuseEffect(() => { setTimeout(() => undefined, 300) }, [])",
        errors: [{ messageId: "unreleased" }],
      }],
    })
  })

  test(edition + " R65 accepts valid propagated errors and rejects invalid swallowed errors", () => {
    tester.run("no-empty-catch", noEmptyCatch, {
      valid: [{ filename: BLOCK, code: "try { run() } catch (error) { throw error }" }],
      invalid: [
        { filename: BLOCK, code: "try { run() } catch {}", errors: [{ messageId: "empty" }] },
        { filename: BLOCK, code: "load().catch(() => undefined)", errors: [{ messageId: "promise" }] },
      ],
    })
  })

  test(edition + " R65 accepts valid product logging and rejects invalid console calls", () => {
    tester.run("no-console", noConsole, {
      valid: [{ filename: BLOCK, code: "logger.error('unavailable')" }],
      invalid: [{ filename: BLOCK, code: "console.error('unavailable')", errors: [{ messageId: "console" }] }],
    })
  })
}
