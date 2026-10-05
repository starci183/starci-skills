/**
 * Twin tests for the comment rules.
 *
 *   node --test comments.spec.mjs
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
  requirePublicMemberJsdoc,
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
const FEATURE_MESSAGES = at("src/features/api/plan/messages/plan.messages.ts")

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

test("COMMENT-3 (R109): every public member of an exported class, interface or object type carries a doc", () => {
  tester.run("require-public-member-jsdoc", requirePublicMemberJsdoc, {
    valid: [
      "/** x */\nexport class PlanService {\n  /** Starts the plan and reserves its seats. */\n  start(): void {}\n  /** The seats still open. */\n  readonly open = 3\n  /** The plan's display title. */\n  get title(): string { return \"\" }\n}",
      // private, protected, # members and the constructor are not public surface
      "/** x */\nexport class PlanService {\n  constructor(private readonly seats: number) {}\n  private load(): void {}\n  protected size = 1\n  #cache = 0\n}",
      // a doc above the decorators documents the decorated member
      "declare const Get: () => MethodDecorator\n/** x */\nexport class PlanController {\n  /** Lists the plans the caller may see. */\n  @Get()\n  list(): void {}\n}",
      // overload signatures share one doc
      "/** x */\nexport class Reader {\n  /** Reads one row or all of them. */\n  read(id: string): string\n  read(): string[]\n  read(id?: string): string | string[] { return id ?? [] }\n}",
      "/** x */\nexport interface PlanRow {\n  /** The plan's stable id. */\n  readonly id: string\n  /** Starts the plan. */\n  start(): void\n  [key: string]: unknown\n}",
      "/** x */\nexport type PlanInput = {\n  /** The plan to start. */\n  readonly planId: string\n}",
      // a type alias that is a union names no members
      "/** x */\nexport type Verdict = \"pass\" | \"fail\"",
      // an un-exported class is local to its file
      "class Local {\n  run(): void {}\n}",
      // a property set to a literal or a named constant is a data constant, as COMMENT-1 has it (a migration's `name`, a consumer's `queue`)
      "declare const PLAN_QUEUE: string\n/** x */\nexport class CreatePlans1758 {\n  name = \"CreatePlans1758\"\n  readonly queue = PLAN_QUEUE\n  readonly label = `plans`\n}",
      // the test tiers document their spec-read shapes at the type
      { filename: at("src/tests/fixtures/plan.views.ts"), code: "/** One plan as the query answers it. */\nexport interface PlanView {\n  id: string\n}" },
      { filename: at("src/tests/world/kit/e2e-http-client.ts"), code: "/** x */\nexport class E2eHttpClient {\n  get(): void {}\n}" },
    ],
    invalid: [
      { code: "/** x */\nexport class PlanService {\n  start(): void {}\n  readonly open: number\n}", errors: [{ messageId: "jsdoc" }, { messageId: "jsdoc" }] },
      { code: "/** x */\nexport class PlanService {\n  static create(): PlanService { return new PlanService() }\n}", errors: [{ messageId: "jsdoc" }] },
      // product source is judged; a property computed by a call is not a data constant
      { filename: SRC, code: "declare function load(): number\n/** x */\nexport class UserService {\n  readonly seats = load()\n}", errors: [{ messageId: "jsdoc" }] },
      { code: "/** x */\nexport interface PlanRow {\n  readonly id: string\n}", errors: [{ messageId: "jsdoc" }] },
      { code: "/** x */\nexport type PlanInput = { readonly planId: string } & { readonly seats: number }", errors: [{ messageId: "jsdoc" }, { messageId: "jsdoc" }] },
      // a line comment is not a doc block
      { code: "/** x */\nexport class PlanService {\n  // starts it\n  start(): void {}\n}", errors: [{ messageId: "jsdoc" }] },
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

/** Vietnamese text written as escapes, so this test file stays English-only ASCII. */
const VI_TEXT = "kh\u00E1ch v\u1EEBa chuy\u1EC3n kho\u1EA3n"
const I18N_FIXTURE = at("src/tests/fixtures/i18n/customer.rows.ts")

test("COMMENT-4: a spec or fixture gets no exemption: Vietnamese is refused wherever it is not a message catalog", () => {
  const SPEC = at("src/features/api/plan/application/place-order.handler.spec.ts")
  const FIXTURE = at("src/tests/fixtures/database.ts")
  tester.run("no-non-ascii-source", noNonAsciiSource, {
    valid: [],
    invalid: [
      { filename: SPEC, code: `const reply = { from: "${VI_TEXT}" }`, errors: [{ messageId: "nonAscii" }] },
      { filename: FIXTURE, code: `// ${VI_TEXT}\nconst x = 1`, errors: [{ messageId: "nonAscii" }] },
      { filename: SRC, code: `const reply = "${VI_TEXT}"`, errors: [{ messageId: "nonAscii" }] },
      // a Vietnamese test name is a finding, in a service spec too
      { filename: at("src/modules/domain/order/order.service.spec.ts"), code: `describe("OrderService", () => {
  it("${VI_TEXT}", () => {})
})`, errors: [{ messageId: "nonAscii" }] },
      // a test title is prose for the next reader: describe/it/test names are English too
      { filename: SPEC, code: `describe("${VI_TEXT}", () => { it("${VI_TEXT}", () => {}) })`, errors: [{ messageId: "nonAscii" }] },
      // an identifier is source prose as well
      { filename: SRC, code: `const ${"h\u1EA1n"}Cuoi = 1`, errors: [{ messageId: "nonAscii" }] },
      // a decomposed (NFD) spelling is caught exactly like the precomposed one
      { filename: SRC, code: `const reply = "${VI_TEXT.normalize("NFD")}"`, errors: [{ messageId: "nonAscii" }] },
      // a fixtures file OUTSIDE the i18n fixtures slot is not exempt
      { filename: at("src/tests/fixtures/customer.rows.ts"), code: `export const ROW = "${VI_TEXT}"`, errors: [{ messageId: "nonAscii" }] },
    ],
  })
})

test("COMMENT-4: the i18n fixtures slot is the one test placement that may carry localized text", () => {
  tester.run("no-non-ascii-source", noNonAsciiSource, {
    valid: [
      { filename: I18N_FIXTURE, code: `export const ROW = { name: "${VI_TEXT}" }` },
      { filename: I18N_FIXTURE, code: `// ${VI_TEXT.normalize("NFD")}\nexport const ROW = 1` },
      // a loanword with no Vietnamese letter is not a hit (structural detection, not a word list)
      { filename: SRC, code: "const word = 'naive facade Muller'" },
    ],
    invalid: [
      { filename: SRC, code: `const row = "${VI_TEXT}"`, errors: [{ messageId: "nonAscii" }] },
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

test("decorated exports and members retain their canonical documentation placement", () => {
  tester.run("require-export-jsdoc", requireExportJsdoc, {
    valid: ["declare const Service: (label?: string) => ClassDecorator\n@Service(\"export\")\n/** Resolves learner accounts for an authorized caller. */\nexport class AccountService {}"],
    invalid: [{ code: "declare const Service: () => ClassDecorator\n@Service()\n/** @file Accounts module. */\nexport class AccountService {}", errors: [{ messageId: "jsdoc" }] }],
  })
  tester.run("require-public-member-jsdoc", requirePublicMemberJsdoc, {
    valid: [
      "declare const Read: () => MethodDecorator\nexport class Accounts {\n/** Returns the account visible to this caller. */\n@Read()\nread(): void {}\n}",
      "export class Reader {\n/** Returns the named account or every visible account. */\nread(id: string): string\nread(): string[]\nread(id?: string): string | string[] { return id ?? [] }\n}",
    ],
    invalid: [
      ...["/** */", "/** @returns One account. */", "/** ... */", "/** @file Accounts module. */", "/** Reads caller-visible accounts. */\n// banner"].map((doc) => ({ code: "export class Accounts {\n" + doc + "\nread(): void {}\n}", errors: [{ messageId: "jsdoc" }] })),
      { code: "export interface Accounts { /** @returns Account id. */ id: string }", errors: [{ messageId: "jsdoc" }] },
      { code: "export type Accounts = { /** */ id: string }", errors: [{ messageId: "jsdoc" }] },
      { code: "export class Reader {\n/** @param id - Account id. */\nread(id: string): string\n/** ... */\nread(): string[]\nread(id?: string): string | string[] { return id ?? [] }\n}", errors: [{ messageId: "jsdoc" }] },
    ],
  })
})

test("enum member tags cannot substitute for a consequence description", () => {
  tester.run("require-enum-member-jsdoc", requireEnumMemberJsdoc, {
    valid: ["export enum Verdict { /** No grant may be made until settlement. */ Pending }"],
    invalid: ["/** */", "/** @type {string} */", "/** ... */", "/** @file Values module. */"].map((doc) => ({ code: "export enum Verdict { " + doc + " Pending }", errors: [{ messageId: "jsdoc" }] })),
  })
})

test("parameter tags cannot conceal an export description that only restates its name", () => {
  tester.run("no-restated-name-jsdoc", noRestatedNameJsdoc, {
    valid: ["/** Reads an authorized learner.\n * @param id - Stable account id.\n */\nexport const readUser = (id: string) => id"],
    invalid: [{ code: "/** The read user function.\n * @param id - Stable account id.\n */\nexport const readUser = (id: string) => id", errors: [{ messageId: "restated" }] }],
  })
})

test("a later exported function declarator cannot hide behind the first data binding", () => {
  tester.run("require-export-jsdoc", requireExportJsdoc, {
    valid: [
      "/** Reads rows visible to the caller; LIMIT is the maximum page size. */\nexport const LIMIT = 10, readRows = () => []",
      "/** Reads rows visible to the caller; LIMIT is the maximum page size. */\nexport const readRows = () => [], LIMIT = 10",
      "/** Reads rows visible to the caller; LIMIT is the maximum page size. */\nexport const LIMIT = 10, readRows = function () { return [] }",
      "export const LIMIT = 10, MAX_ATTEMPTS = 3",
    ],
    invalid: [
      { code: "export const LIMIT = 10, readRows = () => []", errors: [{ messageId: "jsdoc" }] },
      { code: "/** */\nexport const LIMIT = 10, readRows = () => []", errors: [{ messageId: "jsdoc" }] },
      { code: "/** @returns Rows. */\nexport const LIMIT = 10, readRows = function () { return [] }", errors: [{ messageId: "jsdoc" }] },
    ],
  })
})
