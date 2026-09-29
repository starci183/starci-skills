/**
 * Twin tests for the comment rules.
 *
 *   node --test comments.test.mjs
 *
 * The second-language rule that lived here is gone (its job is `no-hardcoded-copy`, with no pragma).
 * What stays is the export documentation rule and the emoji rule, which walks every place prose hides.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { isContentFile, noEmojiInSource, requireExportJsdoc, rules } from "./comments.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const SRC = "D:/repo/src/components/leaves/Text/index.tsx"
/** A fixture path that parses: the dictionaries themselves are `.json`, which the TypeScript parser refuses. */
const LOCALE = "D:/repo/src/components/leaves/Text/fixtures/copy.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("COMMENTS-1: an export opens with a documentation block", () => {
  tester.run("require-export-jsdoc", requireExportJsdoc, {
    valid: [
      "/** What this is for. */\nexport const X = 1",
      "/** A shape. */\nexport interface Y { a: string }",
      // internal helpers are not exports, and requiring a block on each makes a file of ceremony
      "const helper = () => 1\n/** The export. */\nexport const X = helper",
      // a re-export has no declaration to document
      "const X = 1\nexport { X }",
    ],
    invalid: [
      { code: "export const X = 1", errors: [{ messageId: "jsdoc" }] },
      { code: "export type Y = { a: string }", errors: [{ messageId: "jsdoc" }] },
      // a line comment is not a documentation block
      { code: "// what this is\nexport const X = 1", errors: [{ messageId: "jsdoc" }] },
    ],
  })
})

test("COMMENTS-4: no emoji in source, and content files are exempt", () => {
  tester.run("no-emoji-in-source", noEmojiInSource, {
    valid: [
      { filename: SRC, code: "// a plain comment\nconst x = 1" },
      { filename: LOCALE, code: "const t = \"done 🎉\"" },
    ],
    invalid: [
      { filename: SRC, code: "// shipped 🎉\nconst x = 1", errors: [{ messageId: "emoji" }] },
      { filename: SRC, code: "const s = \"🎉\"", errors: [{ messageId: "emoji" }] },
      // a flag is a regional-indicator PAIR, which a single pictograph test misses
      { filename: SRC, code: "const s = \"🇻🇳\"", errors: [{ messageId: "emoji" }] },
    ],
  })
})

test("there is no copy-module exemption: a resources folder is authoring, and the dictionaries are content", () => {
  assert.equal(isContentFile("D:/repo/src/resources/copy.ts"), false)
  assert.equal(isContentFile("D:/repo/src/modules/i18n/messages/vi.json"), true)
  assert.equal(isContentFile("D:/repo/src/components/leaves/Text/index.test.tsx"), true)
  assert.equal(rules["no-second-language-in-source"], undefined)
})
