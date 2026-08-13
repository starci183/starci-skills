/**
 * Twin tests for the comment rules.
 *
 *   node --test comments.test.mjs
 *
 * The cases that earn their place are the ones where prose has MOVED: out of a comment and into an
 * identifier, a diagnostic string or a template chunk. A language rule that only reads comments
 * looks like it works, and the sentence it was written for simply relocates one line.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noEmojiInSource, noSecondLanguageInSource, requireExportJsdoc, rules } from "./comments.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const SRC = "D:/repo/src/components/leaves/Text/index.tsx"
/**
 * A content path that PARSES. The dictionaries themselves are `.json`, which the TypeScript parser
 * refuses outright, so the allowlist entry covering them cannot be exercised from here - eslint
 * does not lint JSON by default either, and that entry is a guard rather than a live path. The
 * resources folder is the content path a rule actually meets.
 */
const LOCALE = "D:/repo/src/resources/copy.ts"
const FIXTURE = "D:/repo/src/components/leaves/Text/index.test.tsx"

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

test("COMMENTS-2: the source is English, wherever the prose hides", () => {
  tester.run("no-second-language-in-source", noSecondLanguageInSource, {
    valid: [
      { filename: SRC, code: "// the reason this exists\nconst x = 1" },
      // the endonym: a language picker must render its own name
      { filename: SRC, code: "const LABEL = \"Tiếng Việt\"" },
      // a functional literal, marked with why it stays
      { filename: SRC, code: "// vn-ok: the server sends this verbatim\nconst S = \"Da huy\"" },
      // the same, with the diacritics the previous fixture happens to lack --
      // without them it passes for the wrong reason and proves nothing
      { filename: SRC, code: "// vn-ok: the server sends this verbatim\nconst S = \"Đã huỷ\"" },
      // and marked where an author actually writes it: at the end of the line
      { filename: SRC, code: "const NAME = \"Học viện Mộc\" // vn-ok: one academy's own name" },
      // locale content IS the other language
      { filename: LOCALE, code: "const t = \"Tiếp tục học\"" },
      // a fixture reproduces a real string, or it tests something else
      { filename: FIXTURE, code: "const t = \"Tiếp tục học\"" },
    ],
    invalid: [
      { filename: SRC, code: "// hạn cuối đã qua\nconst x = 1", errors: [{ messageId: "second" }] },
      // the same sentence, relocated into a string
      { filename: SRC, code: "const message = \"hạn cuối đã qua\"", errors: [{ messageId: "second" }] },
      // and into a template chunk
      { filename: SRC, code: "const message = `hạn cuối đã qua ${x}`", errors: [{ messageId: "second" }] },
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
