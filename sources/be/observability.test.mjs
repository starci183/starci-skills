/**
 * Twin tests for the observability rules.
 *
 *   node --test observability.test.mjs
 *
 * The negative cases carry the weight. `no-interpolated-log-message` fires on the FIRST argument of
 * a log call, and a rule that widened to any template literal anywhere would flag the data object,
 * the message a caller assembles for a user, and half the codebase besides.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noFrameworkLogger, noInterpolatedLogMessage, rules } from "./observability.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("OBSERVABILITY-1: the framework logger is refused, imported or constructed", () => {
  tester.run("no-framework-logger", noFrameworkLogger, {
    valid: [
      "import { Injectable } from '@nestjs/common'",
      // a Logger from somewhere else entirely is not this rule's business
      "import { Logger } from 'winston'",
      "const x = new LoggerFactory()",
    ],
    invalid: [
      {
        code: "import { Injectable, Logger } from '@nestjs/common'",
        errors: [{ messageId: "imported" }],
      },
      {
        // aliased at the import, so only the construction gives it away
        code: "const logger = new Logger('AddToCartHandler')",
        errors: [{ messageId: "constructed" }],
      },
    ],
  })
})

test("OBSERVABILITY-2: the event name comes from the enum, not from a built string", () => {
  tester.run("no-interpolated-log-message", noInterpolatedLogMessage, {
    valid: [
      "this.winstonService.info(WinstonLog.EnrollmentOpened, { userId })",
      "winstonService.error(WinstonLog.EnrollmentFailed, { code })",
      // a template in the DATA is fine - it is the name that must be groupable
      "this.winstonService.info(WinstonLog.Opened, { label: `course ${id}` })",
      // not the logging service
      "this.mailer.info(`sending to ${to}`)",
      // not a log method
      "this.winstonService.configure(`x ${y}`)",
    ],
    invalid: [
      {
        code: "this.winstonService.info(`opened enrollment for ${userId}`)",
        errors: [{ messageId: "built" }],
      },
      {
        code: "this.winstonService.error('enrollment failed: ' + error.message)",
        errors: [{ messageId: "built" }],
      },
      {
        // a bare string is one reword away from being a different event to every dashboard
        code: "winstonService.warn('quota nearly spent', { userId })",
        errors: [{ messageId: "built" }],
      },
    ],
  })
})
