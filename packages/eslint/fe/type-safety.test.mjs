/**
 * Twin tests for the type-safety rule.
 *
 *   node --test type-safety.test.mjs
 *
 * The single cast is the case that matters. `x as T` is a narrowing the compiler can still partly
 * check, and forbidding it would make the rule an argument rather than a boundary - so the valid
 * cases pin that difference down, and the test exemption pins down the one file kind that has to
 * build values the types forbid.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { noDoubleCast, noExplicitAny, noNonNullAssertion, noTypeAssertion, rules } from "./type-safety.mjs"

const tester = slotTester()

const SOURCE = at("apps/web/src/modules/api/client.ts")
const TEST = at("apps/web/src/modules/api/client.test.ts")
const TOOLING = at("apps/web/next.config.ts")

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("TYPE-SAFETY-1: a cast through unknown erases what the compiler knew", () => {
  tester.run("no-double-cast", noDoubleCast, {
    valid: [
      // a single cast is not this rule's business: `no-type-assertion` judges it
      { filename: SOURCE, code: "const row = payload as ResumeRow" },
      // narrowing FROM unknown is the shape this rule is asking for
      { filename: SOURCE, code: "const answer: unknown = parse(text)" },
      { filename: SOURCE, code: "const n = value as unknown" },
      // a test builds values the types forbid, because that is what it is proving
      { filename: TEST, code: "return operation as unknown as ApolloLink.Operation" },
      // tooling and config sit in no product tier
      { filename: TOOLING, code: "const n = value as unknown as Config" },
    ],
    invalid: [
      {
        filename: SOURCE,
        code: "const row = payload as unknown as ResumeRow",
        errors: [{ messageId: "double" }],
      },
      {
        filename: SOURCE,
        code: "const op = build() as unknown as Operation",
        errors: [{ messageId: "double" }],
      },
    ],
  })
})

test("TYPE-SAFETY-2: an assertion is a claim the compiler cannot check", () => {
  tester.run("no-type-assertion", noTypeAssertion, {
    valid: [
      { filename: SOURCE, code: "const tones = ['a', 'b'] as const" },
      { filename: SOURCE, code: "const n = value as unknown" },
      { filename: SOURCE, code: "const row = payload satisfies ResumeRow" },
      { filename: SOURCE, code: "const row = isRow(payload) ? payload : null" },
      // the outer half of a cast through unknown is no-double-cast's finding, not a second one here
      { filename: SOURCE, code: "const row = payload as unknown as ResumeRow" },
      // a test builds values the types forbid
      { filename: TEST, code: "const row = payload as ResumeRow" },
      { filename: TOOLING, code: "const row = payload as ResumeRow" },
    ],
    invalid: [
      { filename: SOURCE, code: "const row = payload as ResumeRow", errors: [{ messageId: "assertion" }] },
      // a shared package is product source
      { filename: at("packages/nivo-ui/src/leaves/Badge/index.tsx"), code: "const row = payload as ResumeRow", errors: [{ messageId: "assertion" }] },
      { filename: SOURCE, code: "const el = node as HTMLElement", errors: [{ messageId: "assertion" }] },
      { filename: SOURCE, code: "const key = id as never", errors: [{ messageId: "assertion" }] },
      { filename: SOURCE, code: "const row = <ResumeRow>payload", errors: [{ messageId: "assertion" }] },
      {
        filename: SOURCE,
        code: "const rows = (a as Row[]).concat(b as Row[])",
        errors: [{ messageId: "assertion" }, { messageId: "assertion" }],
      },
    ],
  })
})

test("TYPE-SAFETY-3: a non-null assertion proves nothing", () => {
  tester.run("no-non-null-assertion", noNonNullAssertion, {
    valid: [
      { filename: SOURCE, code: "const first = rows[0] ?? fallback" },
      { filename: SOURCE, code: "if (row) use(row.id)" },
      { filename: TEST, code: "const first = rows[0]!" },
    ],
    invalid: [
      { filename: SOURCE, code: "const first = rows[0]!", errors: [{ messageId: "bang" }] },
      { filename: SOURCE, code: "use(message.providerOutboxId!)", errors: [{ messageId: "bang" }] },
      { filename: SOURCE, code: "const n = a!.b!.c", errors: [{ messageId: "bang" }, { messageId: "bang" }] },
    ],
  })
})

test("TYPE-SAFETY-4: any turns checking off", () => {
  tester.run("no-explicit-any", noExplicitAny, {
    valid: [
      { filename: SOURCE, code: "const x: unknown = 1" },
      { filename: SOURCE, code: "const anything = 1" },
      { filename: TEST, code: "const x: any = 1" },
    ],
    invalid: [
      { filename: SOURCE, code: "const x: any = 1", errors: [{ messageId: "any" }] },
      { filename: SOURCE, code: "function f(a: Array<any>): void {}", errors: [{ messageId: "any" }] },
      { filename: SOURCE, code: "const x = y as any", errors: [{ messageId: "any" }] },
    ],
  })
})
