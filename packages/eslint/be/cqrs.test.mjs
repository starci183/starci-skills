/**
 * Twin tests for the CQRS rules.
 *
 *   node --test cqrs.test.mjs
 *
 * The decorator check is what keeps these narrow. A class called `SomethingHandler` that is not
 * decorated is not a CQRS handler - it may be a socket handler, a strategy, an adapter - and a rule
 * that fired on the NAME would spend its life being disabled by people who were right.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  handlerHasTwinSpec,
  handlerOverridesProcess,
  messageCarriesParamsOnly,
  noHandlerEncodedFailure,
  rules,
} from "./cqrs.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

const DIR = "D:/repo/src/features/api/core/graphql/mutations/courses/add-to-cart"
const HANDLER = `${DIR}/add-to-cart.handler.ts`
const COMMAND = `${DIR}/add-to-cart.command.ts`
const QUERY = "D:/repo/src/features/api/core/graphql/queries/courses/course/course.query.ts"
const SERVICE = `${DIR}/add-to-cart.service.ts`

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("CQRS-3: a handler implements process, and overriding execute leaves the template", () => {
  tester.run("handler-overrides-process", handlerOverridesProcess, {
    valid: [
      {
        filename: HANDLER,
        code: "@CommandHandler(C) class H extends ICQRSHandler<C, R> { protected override async process(c: C) { return 1 } }",
      },
      {
        filename: HANDLER,
        code: "@QueryHandler(Q) class H { protected async process(q: Q) { return 1 } }",
      },
      {
        filename: HANDLER,
        code: "@EventsHandler(E) class H { protected async process(e: E) { return 1 } }",
      },
      // NOT a CQRS handler - no decorator - so `execute` here is nobody's business
      { filename: SERVICE, code: "class AddToCartService { async execute(p) { return this.bus.execute(p) } }" },
      // a decorated class may carry other methods beside process
      {
        filename: HANDLER,
        code: "@CommandHandler(C) class H { protected async process(c) { return this.load(c) } private load(c) { return 1 } }",
      },
      // inherits `process` from an intermediate abstract handler - a family of suggestion
      // queries that all search the same way implements it once and is subclassed
      { filename: HANDLER, code: "@QueryHandler(Q) class H extends AbstractSuggestionsHandler<Q, R> {}" },
    ],
    invalid: [
      {
        filename: HANDLER,
        code: "@CommandHandler(C) class H extends ICQRSHandler<C, R> { override async execute(c: C) { return 1 } }",
        errors: [{ messageId: "overridesExecute" }],
      },
      {
        filename: HANDLER,
        code: "@CommandHandler(C) class H { constructor() {} }",
        errors: [{ messageId: "noProcess" }],
      },
    ],
  })
})

test("CQRS-2: a message carries params and declares no logic", () => {
  tester.run("message-carries-params-only", messageCarriesParamsOnly, {
    valid: [
      { filename: COMMAND, code: "export class AddToCartCommand { constructor(readonly params: P) {} }" },
      { filename: QUERY, code: "export class CourseQuery { constructor(readonly params: P) {} }" },
      // not a message file
      { filename: HANDLER, code: "class H { helper() { return 1 } }" },
      // a CLI framework's command: same suffix, different thing entirely - it is a door, and
      // doors carry methods
      {
        filename: "D:/repo/src/features/cli/utils/subs/pg-sync.command.ts",
        code: "@Command({ name: 'pg-sync' }) export class PgSyncCommand { async run(argv: Array<string>) { return 1 } }",
      },
    ],
    invalid: [
      {
        filename: COMMAND,
        code: "export class AddToCartCommand { constructor(readonly params: P) {} isValid() { return true } }",
        errors: [{ messageId: "method" }],
      },
      {
        filename: COMMAND,
        code: "export class AddToCartCommand { constructor(readonly request: R, readonly user: U) {} }",
        errors: [{ messageId: "shape" }],
      },
    ],
  })
})

test("CQRS-5: a handler throws its refusal, and does not encode it into the return value", () => {
  tester.run("no-handler-encoded-failure", noHandlerEncodedFailure, {
    valid: [
      // the happy path returns `success: true` - only the false flag encodes a refusal
      {
        filename: HANDLER,
        code: "@CommandHandler(C) class H extends ICQRSHandler<C, R> { protected override async process(c) { return { success: true, data: 1 } } }",
      },
      // the refusal is thrown, which is exactly what CQRS-5 asks for
      {
        filename: HANDLER,
        code: "@CommandHandler(C) class H extends ICQRSHandler<C, R> { protected override async process(c) { if (!c) throw new NotFoundException({}); return { id: 1 } } }",
      },
      // not a handler file - a service is CQRS-4's business, not CQRS-5's
      { filename: SERVICE, code: "class S { execute(p) { return { success: false } } }" },
      // `error` reaches a call argument, never a return value - nothing here is encoded back to a caller
      {
        filename: HANDLER,
        code: "@CommandHandler(C) class H { protected async process(c) { this.ws.error({ error: c }); return } }",
      },
      // a private helper beside `process` is not the handler's refusal path
      {
        filename: HANDLER,
        code: "@CommandHandler(C) class H { protected async process(c) { return this.map(c) } private map(c) { return { error: c } } }",
      },
    ],
    invalid: [
      {
        filename: HANDLER,
        code: "@CommandHandler(C) class H extends ICQRSHandler<C, R> { protected override async process(c) { if (!c) return { success: false }; return { id: 1 } } }",
        errors: [{ messageId: "encoded" }],
      },
      {
        filename: HANDLER,
        code: "@QueryHandler(Q) class H { protected async process(q) { return { error: 'not found' } } }",
        errors: [{ messageId: "encoded" }],
      },
    ],
  })
})

test("CQRS-7: the twin spec is named, and the rule stays silent without a listing", () => {
  tester.run("handler-has-twin-spec", handlerHasTwinSpec, {
    valid: [
      // no listing supplied - the rule must do NOTHING rather than guess
      { filename: HANDLER, code: "class H {}" },
      {
        filename: HANDLER,
        code: "class H {}",
        options: [{ specs: ["add-to-cart.handler.spec.ts"] }],
      },
      {
        filename: SERVICE,
        code: "class S {}",
        options: [{ specs: [] }],
      },
    ],
    invalid: [
      {
        filename: HANDLER,
        code: "class H {}",
        options: [{ specs: ["something-else.handler.spec.ts"] }],
        errors: [{ messageId: "missing" }],
      },
    ],
  })
})
