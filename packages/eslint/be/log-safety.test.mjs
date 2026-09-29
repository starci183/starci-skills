/**
 * Twin tests for the log-safety rule.
 *
 *   node --test log-safety.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noSecretInLog, rules } from "./log-safety.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const SRC = "D:/repo/src/modules/domain/plan/plan.service.ts"
const SPEC = "D:/repo/src/modules/domain/plan/plan.service.spec.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R71: a logger call names no credential and no personal identifier", () => {
  tester.run("no-secret-in-log", noSecretInLog, {
    valid: [
      { filename: SRC, code: "this.logger.log('plan.created', { planId, ownerId })" },
      { filename: SRC, code: "this.logger.log('token.issued', { tokenCount, tokenType })" },
      { filename: SRC, code: "this.logger.warn('login.refused', { tokenLength: token.length })" },
      { filename: SRC, code: "this.logger.warn('login.refused', { token: mask(token) })" },
      { filename: SRC, code: "this.logger.log('seed', { present: Boolean(config.password) })" },
      // the last name says what the value is
      { filename: SRC, code: "this.logger.log('mail.sent', { from: credential.fromAddress })" },
      // not a logger
      { filename: SRC, code: "this.mailer.send({ email, token })" },
      { filename: SPEC, code: "this.logger.log('x', { password })" },
    ],
    invalid: [
      { filename: SRC, code: "this.logger.log('login', { password })", errors: [{ messageId: "secret" }] },
      { filename: SRC, code: "this.logger.error('refresh failed', { refreshToken: session.refreshToken })", errors: [{ messageId: "secret" }] },
      { filename: SRC, code: "this.logger.debug(`calling with ${apiKey}`)", errors: [{ messageId: "secret" }] },
      { filename: SRC, code: "logger.warn('bad header', request.headers.authorization)", errors: [{ messageId: "secret" }] },
      { filename: SRC, code: "this.logger.log('welcome', { email: user.email })", errors: [{ messageId: "pii" }] },
      { filename: SRC, code: "this.winstonService.error(`sending to ${phoneNumber} failed`)", errors: [{ messageId: "pii" }] },
    ],
  })
})
