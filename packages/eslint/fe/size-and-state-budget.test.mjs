/**
 * Twin tests for the size and state budget rules (HFS R65).
 *
 *   node --test size-and-state-budget.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, fixtureHfs, slotTester } from "./fixtures/typed/tester.mjs"
import {
  componentLineBudget,
  noHandRolledPolling,
  rules,
  unitHookBudget,
} from "./size-and-state-budget.mjs"

const tester = slotTester()

const BLOCK = at("apps/web/src/components/blocks/Feed/index.tsx")
const DRAWING = at("apps/web/src/components/blocks/Feed/component.tsx")
const HOOK = at("apps/web/src/hooks/feed/useFeed.ts")

// The budgets are the slot manifest's own numbers: the rule keeps no copy.
const COMPONENTS = fixtureHfs().slot("fe.components").budget
const FEATURE = fixtureHfs().slot("fe.feature").budget

/** `count` lines of code that do nothing. */
const lines = (count) => Array.from({ length: count }, (_, index) => `const line${index} = ${index}`).join("\n")

/** A component with `states` useState calls and `data` data hooks. */
const unit = (name, states, data) =>
  `export const ${name} = () => {\n${Array.from({ length: states }, (_, i) => `  const [s${i}, set${i}] = useState(0)`).join("\n")}\n${Array.from({ length: data }, (_, i) => `  const d${i} = useQueryFeed${i}Swr()`).join("\n")}\n  return null\n}`

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("BUDGET-1: a component file stays within the line budget its slot states for its role", () => {
  assert.deepEqual([COMPONENTS["component.tsx"], COMPONENTS["index.tsx"]], [300, 200])
  tester.run("component-line-budget", componentLineBudget, {
    valid: [
      { filename: DRAWING, code: lines(300) },
      { filename: DRAWING, code: `${lines(300)}
` },
      { filename: BLOCK, code: lines(200) },
      { filename: at("apps/web/src/features/pages/Home/component.tsx"), code: lines(FEATURE["component.tsx"]) },
      // a spec is not held to a budget; a hook and a module by the `file` budget of their slot (200, 400)
      { filename: HOOK, code: lines(200) },
      { filename: at("apps/web/src/modules/feed/index.ts"), code: lines(400) },
      { filename: at("apps/web/src/modules/config/index.ts"), code: lines(400) },
      { filename: at("apps/web/src/components/blocks/Feed/index.test.tsx"), code: lines(400) },
      // a file the slots do not put in a component owner is not judged by this rule
      { filename: at("apps/web/src/modules/components/x.tsx"), code: lines(400) },
      { filename: at("apps/web/src/lib/Big.tsx"), code: lines(400) },
      // a component owner's styling file has no line budget of its own
      { filename: at("apps/web/src/components/blocks/Feed/classNames.ts"), code: lines(400) },
    ],
    invalid: [
      { filename: HOOK, code: lines(201), errors: [{ messageId: "lines", data: { count: 201, max: 200 } }] },
      { filename: at("apps/web/src/modules/feed/index.ts"), code: lines(401), errors: [{ messageId: "lines", data: { count: 401, max: 400 } }] },
      { filename: at("packages/nivo-ui/src/leaves/Chip/component.tsx"), code: lines(301), errors: [{ messageId: "lines" }] },
      { filename: DRAWING, code: lines(301), errors: [{ messageId: "lines", data: { count: 301, max: 300 } }] },
      // the connected entry has the smaller budget
      { filename: BLOCK, code: lines(201), errors: [{ messageId: "lines", data: { count: 201, max: 200 } }] },
      { filename: at("apps/web/src/features/pages/Home/index.tsx"), code: lines(650), errors: [{ messageId: "lines" }] },
      { filename: at("apps/admin/src/features/overlays/Confirm/component.tsx"), code: lines(301), errors: [{ messageId: "lines" }] },
      // a layer folder named like a component still gets its budget from the slot
      { filename: at("apps/web/src/components/leaves/blocks/index.tsx"), code: lines(201), errors: [{ messageId: "lines" }] },
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
      { filename: at("apps/web/src/components/blocks/Feed/index.test.tsx"), code: unit("Feed", 9, 9) },
      // a slot that states no useState / dataHooks budget puts no bound on the count (hooks, features, modules)
      { filename: HOOK, code: unit("useFeed", 6, 6) },
      { filename: at("apps/web/src/modules/feed/index.ts"), code: unit("Feed", 9, 9) },
      // a file no slot owns is not judged
      { filename: at("apps/web/src/lib/x.tsx"), code: unit("Feed", 9, 9) },
    ],
    invalid: [
      { filename: BLOCK, code: unit("Feed", 7, 0), errors: [{ messageId: "state" }] },
      { filename: HOOK, code: unit("useFeed", 7, 0), errors: [{ messageId: "state" }] },
      { filename: at("packages/nivo-ui/src/leaves/Chip/index.tsx"), code: unit("Chip", 0, 7), errors: [{ messageId: "data" }] },
      { filename: BLOCK, code: unit("Feed", 0, 7), errors: [{ messageId: "data" }] },
      { filename: BLOCK, code: unit("Feed", 8, 8), errors: [{ messageId: "state" }, { messageId: "data" }] },
      { filename: at("apps/admin/src/components/leaves/Chip/component.tsx"), code: unit("Chip", 7, 0), errors: [{ messageId: "state" }] },
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
      { filename: at("apps/web/src/components/blocks/Feed/index.test.tsx"), code: "setInterval(() => 1, 10)" },
    ],
    invalid: [
      { filename: BLOCK, code: "const E = () => { useEffect(() => { const t = setInterval(load, 5000); return () => clearInterval(t) }, []) }", errors: [{ messageId: "interval" }] },
      { filename: BLOCK, code: "const t = window.setInterval(load, 5000)", errors: [{ messageId: "interval" }] },
      { filename: HOOK, code: "function poll() { setTimeout(() => { load(); poll() }, 3000) }", errors: [{ messageId: "timeout" }] },
      { filename: HOOK, code: "const poll = () => { setTimeout(function () { poll() }, 3000) }", errors: [{ messageId: "timeout" }] },
    ],
  })
})
