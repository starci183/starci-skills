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
import { at, fixtureHfs } from "./fixtures/typed/tester.mjs"
import {
  noNonAsciiSource,
  noRestatedNameJsdoc,
  requireEnumMemberJsdoc,
  requireExportJsdoc,
  rules,
} from "./comments.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
  settings: { starci: { hfs: fixtureHfs() } },
})

const SRC = at("src/modules/domain/user/user.service.ts")
const MESSAGES = at("src/modules/domain/user/messages/user.messages.ts")
const PLATFORM_MESSAGES = at("src/modules/platform/errors/messages/errors.messages.ts")
const FEATURE_MESSAGES = at("src/features/plan/messages/plan.messages.ts")

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

test("COMMENT-4: a spec or fixture gets no exemption: Vietnamese is refused wherever it is not a message catalog", () => {
  const SPEC = at("src/features/plan/application/place-order.handler.spec.ts")
  const FIXTURE = at("src/tests/fixtures/database.ts")
  tester.run("no-non-ascii-source", noNonAsciiSource, {
    valid: [],
    invalid: [
      { filename: SPEC, code: "const reply = { from: \"khách vừa chuyển khoản\" }", errors: [{ messageId: "nonAscii" }] },
      { filename: FIXTURE, code: "// kiểm tra luồng thanh toán\nconst x = 1", errors: [{ messageId: "nonAscii" }] },
      { filename: SRC, code: "const reply = \"khách vừa chuyển khoản\"", errors: [{ messageId: "nonAscii" }] },
    ],
  })
})

test("COMMENT-4: source prose is English and no marker exempts a line", () => {
  tester.run("no-non-ascii-source", noNonAsciiSource, {
    valid: [
      { filename: SRC, code: "const greeting = 'hello'" },
      // a message catalog (slot be.domain.messages or be.feature.messages) is product copy, not source prose
      { filename: FEATURE_MESSAGES, code: "// b\u1ea3n d\u1ecbch\nexport const vi = { hello: 'Xin ch\u00e0o' }" },
      { filename: MESSAGES, code: "export const vi = { hello: 'Xin ch\u00e0o' }" },
      // a platform capability owns its catalog too (BE-CONVENTION 1.15, 1.18)
      { filename: PLATFORM_MESSAGES, code: "export const vi = { hello: 'Xin ch\u00e0o' }" },
    ],
    invalid: [
      // platform source outside its messages/ catalog is still English only
      { filename: at("src/modules/platform/errors/errors.service.ts"), code: "export const vi = { hello: 'Xin ch\u00e0o' }", errors: [{ messageId: "nonAscii" }] },
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
