/**
 * Twin tests for the naming rules.
 *
 *   node --test naming.test.mjs
 *
 * The cases that matter here are the NEGATIVE ones. Both rules are narrow on purpose, and a rule
 * that widens quietly is worse than one that misses: the day `handlerOnPrefix` starts firing on a
 * local that merely describes an action, every author learns that the rule is noise and stops
 * reading what it says.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { handlerOnPrefix, noDirectConstAlias, preferArrowExport, rules } from "./naming.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("NAMING-1: a module-level function declaration goes back to an arrow const", () => {
  tester.run("prefer-arrow-export", preferArrowExport, {
    valid: [
      "export const E = () => null",
      "const format = (v) => `${v}`",
      // nested declarations are not module-level, and hoisting inside one scope is not the failure
      "export const E = () => { function inner() { return 1 } return inner() }",
    ],
    invalid: [
      { code: "export function E() { return null }", errors: [{ messageId: "fn" }] },
      { code: "function format(v) { return v }", errors: [{ messageId: "fn" }] },
      { code: "export default function Route() { return null }", errors: [{ messageId: "fn" }] },
    ],
  })
})

test("NAMING-2: a handler is named for the slot it will be passed into", () => {
  tester.run("handler-on-prefix", handlerOnPrefix, {
    valid: [
      "const onClaim = () => claim()",
      "const E = () => <Button on={{ press: onClaim }} />",
      // not a handler: a value, and `on` would be a lie
      "const claimLabel = build()",
      // the prefix alone is not enough - `handled` is a word, not the `handleX` pattern
      "const handled = true",
      "const handler = build()",
    ],
    invalid: [
      { code: "const handleClaim = () => claim()", errors: [{ messageId: "handle" }] },
      { code: "const E = () => <Button handlePress={x} />", errors: [{ messageId: "handle" }] },
      {
        code: "type P = { readonly handleSubmit?: () => void }",
        errors: [{ messageId: "handle" }],
      },
    ],
  })
})

test("NAMING-3: a path names its file in the one language every reader shares", () => {
  tester.run("no-second-language-in-path", rules["no-second-language-in-path"], {
    valid: [
      // The ordinary case: an English route, whatever the copy inside it turns out to be.
      { filename: "/repo/src/app/provisioning/page.tsx", code: "export const x = 1" },
      // The words a reader sees live in the catalogue, and the catalogue's own name is English.
      { filename: "/repo/src/messages/vi.json.ts", code: "export const x = 1" },
      // ENGLISH WORDS THAT LOOK LIKE THE ROMANISED LIST ARE NOT IT. `cap` and `dang` open several
      // ordinary English names, and a rule that refused them would be noise its readers learn to
      // ignore - which costs more than the case it was reaching for.
      { filename: "/repo/src/app/capacity/page.tsx", code: "export const x = 1" },
      { filename: "/repo/src/components/leaves/DangerBadge/index.tsx", code: "export const x = 1" },
    ],
    invalid: [
      // Diacritics survive in a folder name even though a URL segment drops them.
      {
        filename: "/repo/src/app/cấp-phát/page.tsx",
        code: "export const x = 1",
        errors: [{ messageId: "path" }],
      },
      // The form that actually reaches the filesystem, and the one an accent check cannot see.
      {
        filename: "/repo/src/app/cap-phat/page.tsx",
        code: "export const x = 1",
        errors: [{ messageId: "path" }],
      },
      // A route group's parentheses are punctuation around the name, not part of it.
      {
        filename: "/repo/src/app/(auth)/dang-nhap/page.tsx",
        code: "export const x = 1",
        errors: [{ messageId: "path" }],
      },
    ],
  })
})

test("machine-only: a const introduces a value instead of renaming one identifier", () => {
  tester.run("no-direct-const-alias", noDirectConstAlias, {
    valid: [
      "const Apollo = createApolloClient()",
      "const Apollo = clients.ApolloClient",
      "const Apollo = await ApolloClient",
      "const { ApolloClient: Apollo } = clients",
      "let Apollo = ApolloClient",
    ],
    invalid: [
      {
        code: "const StarCiApolloClient = ApolloClient",
        errors: [{ messageId: "alias", data: { alias: "StarCiApolloClient", original: "ApolloClient" } }],
      },
      {
        code: "const localValue: typeof sourceValue = sourceValue",
        errors: [{ messageId: "alias", data: { alias: "localValue", original: "sourceValue" } }],
      },
      {
        code: "const first = source, second = source",
        errors: [{ messageId: "alias" }, { messageId: "alias" }],
      },
    ],
  })
})
