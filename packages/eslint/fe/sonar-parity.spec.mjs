/**
 * Tests for the Sonar parity law (R235 SCAN_SMELL) on the front end: the rule only this axis publishes, and the registration of the shared ones.
 *
 *   node --test sonar-parity.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { SONAR_SYNTAX_RULES } from "./runtime/scripts/lib/sonar-syntax-rules.mjs"
import { recommended, rules } from "./sonar-parity.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
})

test("the law publishes the shared rules at error under their own names", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.equal(rule, SONAR_SYNTAX_RULES[name])
    assert.equal(recommended[`starci-fe/${name}`], "error")
  }
  assert.ok(!("async-needs-await" in rules), "S7503 is the borrowed typescript-eslint rule")
  assert.ok("no-unused-prop-types" in rules)
})

const rule = (name) => SONAR_SYNTAX_RULES[name]
const LOOP = "async function a(items) { for (const item of items) await send(item) }"

test("S9382: no await in a loop; an endless loop and a spec are outside", () => {
  tester.run("no-await-in-loop", rule("no-await-in-loop"), {
    valid: ["async function a(items) { await Promise.all(items.map((item) => send(item))) }", "async function b() { for (;;) { await tick() } }", { filename: "src/a.spec.tsx", code: LOOP }],
    invalid: [{ code: LOOP, errors: [{ messageId: "loop" }] }],
  })
})

test("S7758: codePointAt instead of charCodeAt", () => {
  tester.run("prefer-code-point", rule("prefer-code-point"), {
    valid: ["const a = char.codePointAt(0)"],
    invalid: [{ code: "const a = char.charCodeAt(0)", errors: [{ messageId: "codePoint" }] }],
  })
})

test("S7780: a string that only escapes backslashes is written with String.raw; a Next matcher keeps its escapes", () => {
  tester.run("prefer-string-raw", rule("prefer-string-raw"), {
    valid: [String.raw`const a = "no escapes"`, String.raw`export const config = { matcher: ["/((?!api|.*\\..*).*)"] }`],
    invalid: [{ code: String.raw`const a = "a\\dir\\file"`, errors: [{ messageId: "raw" }] }],
  })
})

test("S3358: a conditional expression is not nested in another", () => {
  tester.run("no-nested-conditional", rule("no-nested-conditional"), {
    valid: ["const a = x ? 1 : 2"],
    invalid: [{ code: "const a = x ? 1 : y ? 2 : 3", errors: [{ messageId: "nested" }] }],
  })
})

test("S3735: void is kept only on a call", () => {
  tester.run("no-void-operator", rule("no-void-operator"), {
    valid: ["void attempts.mutate()"],
    invalid: [{ code: "void principal", errors: [{ messageId: "void" }] }],
  })
})

test("S1128: an import nothing reads is removed", () => {
  tester.run("no-unused-import", rule("no-unused-import"), {
    valid: ["import { a } from 'x'\nexport const b = a()", "import type { T } from 'x'\nexport const b: T = 1"],
    invalid: [{ code: "import { Order, Handoff } from 'x'\nexport const b: Handoff = 1", errors: [{ messageId: "unused", data: { name: "Order" } }] }],
  })
})

test("S7763: an import that is only handed on is re-exported with export from", () => {
  tester.run("prefer-export-from", rule("prefer-export-from"), {
    valid: ["export { a } from 'x'", "import { a } from 'x'\nexport const b = a()\nexport { a }"],
    invalid: [{ code: "import { appHomeMetadata } from 'x'\nexport const generateMetadata = appHomeMetadata", errors: [{ messageId: "reexport" }] }],
  })
})

test("S6767: a member of the props type that the component never reads is removed", () => {
  tester.run("no-unused-prop-types", SONAR_SYNTAX_RULES["no-unused-prop-types"], {
    valid: [
      // every member is read, through the parameter or through a destructuring
      "type Props = { readonly title: string; readonly on: { go: () => void } }\nconst Block = (props: Props) => <h1 onClick={props.on.go}>{props.title}</h1>",
      "type Props = { readonly title: string; readonly note: string }\nconst Block = ({ title, note }: Props) => <h1 title={note}>{title}</h1>",
      "interface Props { readonly title: string }\nconst Block = (props: Props) => { const { title } = props; return <h1>{title}</h1> }",
      // the parameter escapes whole, or is rest-destructured: every member counts as read
      "type Props = { readonly a: string; readonly b: string }\nconst Block = (props: Props) => <Inner {...props} />",
      "type Props = { readonly a: string; readonly b: string }\nconst Block = ({ a, ...rest }: Props) => <Inner a={a} {...rest} />",
      // a type declared elsewhere cannot be seen, and a function without JSX is not a component
      "const Block = (props: Props) => <h1>{props.title}</h1>",
      "type Props = { readonly unused: string }\nconst helper = (props: Props) => 1",
    ],
    invalid: [
      {
        code: "type Props = { readonly state: 'list'; readonly props: { title: string } }\nconst Block = (props: Props) => <h1>{props.props.title}</h1>",
        errors: [{ messageId: "unused", data: { name: "state" } }],
      },
      {
        code: "type Props = { readonly title: string; readonly note: string }\nconst Block = ({ title }: Props) => <h1>{title}</h1>",
        errors: [{ messageId: "unused", data: { name: "note" } }],
      },
      {
        code: "interface Props { readonly title: string; readonly note: string }\nfunction Block(props: Readonly<Props>) { return <h1>{props.title}</h1> }",
        errors: [{ messageId: "unused", data: { name: "note" } }],
      },
    ],
  })
})
