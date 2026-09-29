/**
 * Twin tests for the size and state budget rules (HFS R65).
 *
 *   node --test size-and-state-budget.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  MAX_COMPONENT_LINES,
  componentLineBudget,
  noHandRolledPolling,
  rules,
  unitHookBudget,
} from "./size-and-state-budget.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const BLOCK = "D:/repo/src/components/blocks/Feed/index.tsx"
const HOOK = "D:/repo/src/hooks/feed/useFeed.ts"

/** `count` lines of code that do nothing. */
const lines = (count) => Array.from({ length: count }, (_, index) => `const line${index} = ${index}`).join("\n")

/** A component with `states` useState calls and `data` data hooks. */
const unit = (name, states, data) =>
  `export const ${name} = () => {\n${Array.from({ length: states }, (_, i) => `  const [s${i}, set${i}] = useState(0)`).join("\n")}\n${Array.from({ length: data }, (_, i) => `  const d${i} = useQueryFeed${i}Swr()`).join("\n")}\n  return null\n}`

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("BUDGET-1: a component file has at most 300 lines", () => {
  assert.equal(MAX_COMPONENT_LINES, 300)
  tester.run("component-line-budget", componentLineBudget, {
    valid: [
      { filename: BLOCK, code: lines(300) },
      { filename: BLOCK, code: `${lines(300)}\n` },
      // only components are held to it: a hook file, a module and a spec are not
      { filename: HOOK, code: lines(400) },
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: lines(400) },
    ],
    invalid: [
      { filename: BLOCK, code: lines(301), errors: [{ messageId: "lines", data: { count: 301, max: 300 } }] },
      { filename: "D:/repo/src/features/pages/Home/index.tsx", code: lines(650), errors: [{ messageId: "lines" }] },
    ],
  })
})

test("BUDGET-2: a unit holds at most six state hooks and six data hooks", () => {
  tester.run("unit-hook-budget", unitHookBudget, {
    valid: [
      { filename: BLOCK, code: unit("Feed", 6, 6) },
      { filename: BLOCK, code: unit("Feed", 0, 0) },
      // two small units in one file do not add up
      { filename: BLOCK, code: `${unit("A", 4, 4)}\n${unit("B", 4, 4)}` },
      // a callback that is not a unit does not own the calls
      { filename: BLOCK, code: "export const Feed = () => { const a = items.map(() => 1); const [x] = useState(0); return a }" },
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: unit("Feed", 9, 9) },
    ],
    invalid: [
      { filename: BLOCK, code: unit("Feed", 7, 0), errors: [{ messageId: "state" }] },
      { filename: BLOCK, code: unit("Feed", 0, 7), errors: [{ messageId: "data" }] },
      { filename: BLOCK, code: unit("Feed", 8, 8), errors: [{ messageId: "state" }, { messageId: "data" }] },
      { filename: HOOK, code: unit("useFeed", 7, 0), errors: [{ messageId: "state" }] },
      {
        filename: BLOCK,
        code: "export function Feed() { const a = useState(0); const b = useState(0); const c = useState(0); const d = useState(0); const e = useState(0); const f = useState(0); const g = React.useState(0); return null }",
        errors: [{ messageId: "state" }],
      },
    ],
  })
})

test("BUDGET-3: no hand-rolled polling loop", () => {
  tester.run("no-hand-rolled-polling", noHandRolledPolling, {
    valid: [
      { filename: BLOCK, code: "const E = () => { const d = useQueryFeedSwr({ refreshInterval: 5000 }); return d }" },
      // a one-shot delay is not a loop
      { filename: BLOCK, code: "const E = () => { useEffect(() => { const t = setTimeout(() => setOpen(false), 300); return () => clearTimeout(t) }, []) }" },
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: "setInterval(() => 1, 10)" },
    ],
    invalid: [
      { filename: BLOCK, code: "const E = () => { useEffect(() => { const t = setInterval(load, 5000); return () => clearInterval(t) }, []) }", errors: [{ messageId: "interval" }] },
      { filename: BLOCK, code: "const t = window.setInterval(load, 5000)", errors: [{ messageId: "interval" }] },
      { filename: HOOK, code: "function poll() { setTimeout(() => { load(); poll() }, 3000) }", errors: [{ messageId: "timeout" }] },
      { filename: HOOK, code: "const poll = () => { setTimeout(function () { poll() }, 3000) }", errors: [{ messageId: "timeout" }] },
    ],
  })
})
