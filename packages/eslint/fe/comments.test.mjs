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
import { at, fixtureHfs, slotTester } from "./fixtures/typed/tester.mjs"
import { isContentFile, noEmojiInSource, requireExportJsdoc, rules } from "./comments.mjs"

const tester = slotTester()

const SRC = at("apps/web/src/components/leaves/Text/index.tsx")
/** A content file that parses: the e2e fixtures (the dictionaries themselves are `.json`, which the TypeScript parser refuses). */
const LOCALE = at("e2e/fixtures/copy.ts")

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
      { filename: at("apps/web/src/components/leaves/Text/index.spec.tsx"), code: "const t = \"done 🎉\"" },
    ],
    invalid: [
      { filename: SRC, code: "// shipped 🎉\nconst x = 1", errors: [{ messageId: "emoji" }] },
      { filename: SRC, code: "const s = \"🎉\"", errors: [{ messageId: "emoji" }] },
      // a folder named fixtures inside a component owner is authoring, not content
      { filename: at("apps/web/src/components/leaves/Text/fixtures/copy.ts"), code: "const s = \"🎉\"", errors: [{ messageId: "emoji" }] },
      // a flag is a regional-indicator PAIR, which a single pictograph test misses
      { filename: SRC, code: "const s = \"🇻🇳\"", errors: [{ messageId: "emoji" }] },
    ],
  })
})

test("there is no copy-module exemption: a resources folder is authoring, and the dictionaries are content", () => {
  const settings = { starci: { hfs: fixtureHfs() } }
  const content = (rel) => isContentFile({ filename: at(rel), settings })
  assert.equal(content("apps/web/src/modules/resources/copy.ts"), false)
  assert.equal(content("apps/web/src/modules/i18n/messages/vi.json"), true)
  assert.equal(content("packages/nivo-i18n/messages/vi.json"), true)
  // code of the i18n module is authoring: only its dictionaries are content
  assert.equal(content("apps/web/src/modules/i18n/request.ts"), false)
  assert.equal(content("apps/web/src/components/leaves/Text/index.test.tsx"), true)
  assert.equal(content("e2e/fixtures/copy.ts"), true)
  assert.equal(content("apps/web/src/components/leaves/Text/fixtures/copy.ts"), false)
  assert.equal(rules["no-second-language-in-source"], undefined)
})
