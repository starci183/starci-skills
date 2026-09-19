/**
 * Twin tests for the comment rules.
 *
 *   node --test comments.test.mjs
 *
 * The data constant and the marked literal are the cases that matter. A doc rule that demanded a
 * sentence beside `export const MAX_ATTEMPTS = 3` would produce sentences restating names, which is
 * the thing the law it enforces forbids; and an ASCII rule with no exit would turn a string the
 * provider actually sends into a "fix" that breaks the comparison.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  noNonAsciiSource,
  noRestatedNameJsdoc,
  requireEnumMemberJsdoc,
  requireExportJsdoc,
  requireVnOkReason,
  rules,
} from "./comments.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

const SRC = "D:/repo/src/modules/bussiness/user/user.service.ts"
const MESSAGES = "D:/repo/src/messages/vi.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("COMMENT-1: an export with a surface needs a doc; a data constant does not", () => {
  tester.run("require-export-jsdoc", requireExportJsdoc, {
    valid: [
      "/** Reads a learner. */\nexport const readUser = () => null",
      "/** A learner. */\nexport interface User { id: string }",
      "/** How the grade came out. */\nexport enum Verdict { Pass }",
      // a data constant is already fully described by its own name
      "export const MAX_ATTEMPTS = 3",
      // a re-export has nothing here to document
      "export { readUser }",
    ],
    invalid: [
      { code: "export const readUser = () => null", errors: [{ messageId: "jsdoc" }] },
      { code: "export interface User { id: string }", errors: [{ messageId: "jsdoc" }] },
      { code: "export class UserService {}", errors: [{ messageId: "jsdoc" }] },
    ],
  })
})

test("COMMENT-2: every member of an exported enum carries its own doc", () => {
  tester.run("require-enum-member-jsdoc", requireEnumMemberJsdoc, {
    valid: [
      "/** x */\nexport enum Verdict {\n  /** Nothing settled, so nothing is granted. */\n  Pending,\n}",
      // an un-exported enum is local vocabulary
      "enum Local { A, B }",
    ],
    invalid: [
      {
        code: "/** x */\nexport enum Verdict {\n  Pending,\n  Settled,\n}",
        errors: [{ messageId: "jsdoc" }, { messageId: "jsdoc" }],
      },
    ],
  })
})

test("COMMENT-4: a fixture lane keeps its data and still gives up its prose", () => {
  const FIXTURE = "/repo/src/tests/e2e/support-ticket.e2e-spec.ts"
  tester.run("no-non-ascii-source", noNonAsciiSource, {
    valid: [
      // the sentence a real customer types IS the thing under test - translating it would test a
      // system nobody uses
      {
        filename: FIXTURE,
        code: "const message = \"Anh chuyen roi nhe, em nhan duoc chua?\".replace(\"a\", \"ă\")",
      },
      {
        filename: FIXTURE,
        code: "const reply = { from: \"khách vừa chuyển khoản\" }",
      },
    ],
    invalid: [
      // a comment in a spec is prose like anywhere else: the next reader still cannot follow it
      {
        filename: FIXTURE,
        code: "// kiểm tra luồng thanh toán\nconst x = 1",
        errors: [{ messageId: "nonAscii" }],
      },
      // and outside a fixture lane, a string is prose again
      {
        filename: "/repo/src/modules/billing/charge.service.ts",
        code: "const reply = \"khách vừa chuyển khoản\"",
        errors: [{ messageId: "nonAscii" }],
      },
    ],
  })
})

test("COMMENT-4: source stays ASCII unless the line is marked as depended-upon data", () => {
  tester.run("no-non-ascii-source", noNonAsciiSource, {
    valid: [
      { filename: SRC, code: "const greeting = 'hello'" },
      {
        // the provider sends this exact string; translating it breaks the comparison. The marker
        // sits on the SAME line as the literal it keeps, which is the whole convention: a marker on
        // the line above would exempt a line whose contents nobody looked at.
        filename: SRC,
        code: "const ok = 'Giao dich th\u00e0nh c\u00f4ng' // vn-ok: the provider returns this exact string",
      },
      // locale files are product copy, not source prose
      { filename: MESSAGES, code: "export const vi = { hello: 'Xin ch\u00e0o' }" },
    ],
    invalid: [
      {
        filename: SRC,
        code: "// Ki\u1ec3m tra ng\u01b0\u1eddi d\u00f9ng\nconst x = 1",
        errors: [{ messageId: "nonAscii" }],
      },
      {
        filename: SRC,
        code: "// done \u2705\nconst x = 1",
        errors: [{ messageId: "nonAscii" }],
      },
    ],
  })
})

test("law 6: a vn-ok marker carries a reason; a bare marker is not an exemption", () => {
  tester.run("require-vn-ok-reason", requireVnOkReason, {
    valid: [
      // the marker names the fact the next sweep needs: the provider sends this exact string
      {
        filename: SRC,
        code: "const ok = 'Giao dich thanh cong' // vn-ok: the provider returns this exact string",
      },
      // a file with no marker at all is not this rule's concern
      { filename: SRC, code: "const greeting = 'hello'" },
    ],
    invalid: [
      // no colon, no reason - a bare marker used as a silent gate-off switch
      {
        filename: SRC,
        code: "const ok = 'Giao dich thanh cong' // vn-ok",
        errors: [{ messageId: "bareMarker" }],
      },
      // a colon with nothing after it is still bare - the marker states no reason
      {
        filename: SRC,
        code: "const ok = 'Giao dich thanh cong' // vn-ok:",
        errors: [{ messageId: "bareMarker" }],
      },
    ],
  })
})

test("law 7: a doc block that only re-spells the declared name is COMMENT-3 wearing COMMENT-1's shape", () => {
  tester.run("no-restated-name-jsdoc", noRestatedNameJsdoc, {
    valid: [
      // says what it is FOR, in words the name itself does not carry
      "/** Reads a learner. */\nexport const readUser = () => null",
      // real consequence, not the member's own name re-spelled
      "/** x */\nexport enum Verdict {\n  /** Nothing settled, so nothing is granted. */\n  Pending,\n}",
      // no doc block at all is require-export-jsdoc's concern, not this rule's
      "export const readUser = () => null",
    ],
    invalid: [
      // "the" and "function" are filler; what is left is exactly "read user" - the name re-spelled
      {
        code: "/** The read user function. */\nexport const readUser = () => null",
        errors: [{ messageId: "restated" }],
      },
      // the law's own anchor example: "the pending state" teaches nothing "Pending" did not already say
      {
        code: "/** x */\nexport enum Verdict {\n  /** The pending state. */\n  Pending,\n}",
        errors: [{ messageId: "restated" }],
      },
    ],
  })
})
