/**
 * Twin tests for the comment rules.
 *
 *   node --test comments.spec.mjs
 *
 * The export documentation rule, the emoji rule and the Vietnamese rule, which walk every place prose hides. Vietnamese
 * letters in these cases are written as \u escapes, so this file itself stays English-only ASCII.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, fixtureHfs, slotTester } from "./fixtures/typed/tester.mjs"
import { isContentFile, noEmojiInSource, noVietnameseInSource, requireExportJsdoc, rules } from "./comments.mjs"

const tester = slotTester()

const SRC = at("apps/web/src/components/leaves/Text/index.tsx")

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

test("COMMENTS-4: no emoji in source", () => {
  tester.run("no-emoji-in-source", noEmojiInSource, {
    valid: [
      { filename: SRC, code: "// a plain comment\nconst x = 1" },
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

/** "han cuoi da qua" spelled with Vietnamese letters, precomposed (NFC), written as escapes so this file stays ASCII. */
const VI_NFC = "h\u1ea1n cu\u1ed1i \u0111\u00e3 qua"
/** The same text decomposed (NFD): base letters followed by combining marks. */
const VI_NFD = VI_NFC.normalize("NFD")

test("COMMENTS-5: no Vietnamese anywhere in source, specs and test titles included", () => {
  assert.notEqual(VI_NFC, VI_NFD)
  tester.run("no-vietnamese-in-source", noVietnameseInSource, {
    valid: [
      { filename: SRC, code: "// a plain English comment\nconst deadline = \"passed\"" },
      // a loanword with no Vietnamese letter is not a hit (structural detection, not a word list)
      { filename: SRC, code: "const naive = \"facade Muller\"" },
    ],
    invalid: [
      { filename: SRC, code: `const message = "${VI_NFC}"`, errors: [{ messageId: "vietnamese" }] },
      // decomposed spelling is caught exactly like the precomposed one
      { filename: SRC, code: `const message = "${VI_NFD}"`, errors: [{ messageId: "vietnamese" }] },
      { filename: SRC, code: `const message = \`${VI_NFC} \${x}\``, errors: [{ messageId: "vietnamese" }] },
      { filename: SRC, code: `// ${VI_NFC}\nconst x = 1`, errors: [{ messageId: "vietnamese" }] },
      { filename: SRC, code: `const ${"h\u1ea1n"} = 1`, errors: [{ messageId: "vietnamese" }] },
      { filename: SRC, code: `const E = () => <p>${VI_NFC}</p>`, errors: [{ messageId: "vietnamese" }] },
      // a spec is authoring: its test titles are English too
      { filename: at("apps/web/src/components/leaves/Text/index.spec.tsx"), code: `it("${VI_NFC}", () => {})`, errors: [{ messageId: "vietnamese" }] },
      // a fixtures folder outside the i18n slot is not exempt
      { filename: at("e2e/fixtures/copy.ts"), code: `export const SAMPLE = "${VI_NFC}"`, errors: [{ messageId: "vietnamese" }] },
      // a pragma excuses nothing
      { filename: SRC, code: `// vn-ok: server text\nconst s = "${VI_NFC}"`, errors: [{ messageId: "vietnamese" }] },
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
  assert.equal(content("apps/web/src/components/leaves/Text/fixtures/copy.ts"), false)
  assert.equal(rules["no-second-language-in-source"], undefined)
})

test("public documentation requires a final adjacent description, not tags, headers or punctuation", () => {
  tester.run("require-export-jsdoc", requireExportJsdoc, {
    valid: [
      "/** Returns the rows visible to the authenticated caller.\n * @returns Authorized rows.\n */\nexport const readRows = () => []",
      "/** Contains the authenticated caller's stable identifier. */\nexport type Viewer = { id: string }",
      "/** Stable learner identity accepted by account operations. */\nexport interface Learner { id: string }",
      "/** @file Rows module. */\n/** Returns caller-visible rows. */\nexport const readRows = () => []",
      "const text = '/** Not a source comment. */'\n/** Reads caller-visible rows. */\nexport const readRows = () => text",
    ],
    invalid: [
      ...["/** */", "/**\n *\n */", "/** @returns Authorized rows. */", "/** @param input - Accepted account id. */", "/** ... --- */", "/** @file Rows module. */", "/** @fileoverview Rows module. */", "/** Rows module.\n * @fileoverview Shared file header.\n */", "/* Returns caller-visible rows. */"].map((doc) => ({ code: doc + "\nexport const readRows = () => []", errors: [{ messageId: "jsdoc" }] })),
      { code: "/** Returns caller-visible rows. */\n// module banner\nexport const readRows = () => []", errors: [{ messageId: "jsdoc" }] },
      { code: "/** Returns caller-visible rows. */\nconst unrelated = 1\nexport const readRows = () => unrelated", errors: [{ messageId: "jsdoc" }] },
      { code: "const text = '/** Returns caller-visible rows. */'\nexport const readRows = () => text", errors: [{ messageId: "jsdoc" }] },
      { code: "const text = \u0060/** Returns caller-visible rows. */\u0060\nexport const readRows = () => text", errors: [{ messageId: "jsdoc" }] },
      { code: "/** @returns Account identifier. */\nexport interface Learner { id: string }", errors: [{ messageId: "jsdoc" }] },
    ],
  })
})
