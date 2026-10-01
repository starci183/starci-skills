/**
 * Twin tests for the observability rules.
 *
 *   node --test observability.spec.mjs
 *
 * The Logger is identified by its type, so the cases carry the loopholes: a renamed receiver, a property injection, a
 * lookalike `Logger` declared by an ordinary owner, and a spec. The negative cases carry the weight:
 * `no-interpolated-log-message` fires on the FIRST argument of a Logger call only.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { noFrameworkLogger, noInterpolatedLogMessage, noErrorWordingAsLogIdentity, recommended, rules } from "./observability.mjs"

const tester = typedTester()
const SRC = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const LOGGING = at("src/modules/platform/logging/json-logger.service.ts")
const PRELUDE = [
  'import type { Logger } from "@modules/platform/logging/logging.port"',
  'import type { Logger as Fake } from "@modules/domain/order/lookalike.service"',
  'import { OrderLogEvent } from "@modules/domain/order/order.log-events"',
  'import { OrderStatus } from "@modules/domain/order/order.type"',
  "declare const logger: Logger",
  "declare const fake: Fake",
  "declare const cause: unknown",
].join("\n")
const withPrelude = (body) => `${PRELUDE}\n${body}`

test("every rule this law declares is exported under its published name, at error, with no exemption list", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
  for (const level of Object.values(recommended)) assert.equal(level, "error")
})

test("OBSERVABILITY-1: the framework logger is refused, imported, constructed or extended", () => {
  tester.run("no-framework-logger", noFrameworkLogger, {
    valid: [
      { filename: SRC, code: "import { Injectable } from '@nestjs/common'" },
      // a Logger from somewhere else entirely is not this rule's business
      { filename: SRC, code: "import type { Logger } from '@modules/platform/logging/logging.port'\ndeclare const logger: Logger" },
      { filename: SRC, code: "const x = new LoggerFactory()" },
      { filename: SRC, code: "import { Logger } from '@modules/domain/order/lookalike.service'\nconst wrapped = (): Logger => ({ info: () => undefined })" },
    ],
    invalid: [
      { filename: SRC, code: "import { Injectable, Logger } from '@nestjs/common'", errors: [{ messageId: "imported" }] },
      { filename: SRC, code: "import { ConsoleLogger } from '@nestjs/common'", errors: [{ messageId: "imported" }] },
      // aliased at the import: the import check sees the imported name, the construction check sees the type
      { filename: SRC, code: "import { Logger as NestLogger } from '@nestjs/common'\nconst logger = new NestLogger('Handler')", errors: [{ messageId: "imported" }, { messageId: "constructed" }] },
      { filename: SRC, code: "import * as common from '@nestjs/common'\nconst logger = new common.Logger('Handler')", errors: [{ messageId: "constructed" }] },
      { filename: SRC, code: "import * as common from '@nestjs/common'\nclass Mine extends common.Logger {}", errors: [{ messageId: "extended" }] },
      // specs are not exempt
      { filename: SPEC, code: "import { Logger } from '@nestjs/common'", errors: [{ messageId: "imported" }] },
    ],
  })
})

test("OBSERVABILITY-1: the platform/logging owner may build what it adapts", () => {
  tester.run("no-framework-logger", noFrameworkLogger, {
    valid: [{ filename: LOGGING, code: "import { Logger } from '@nestjs/common'\nexport const inner = new Logger('adapter')" }],
    invalid: [],
  })
})

test("OBSERVABILITY-2: a Logger call's first argument is a member of a log-events enum", () => {
  tester.run("no-interpolated-log-message", noInterpolatedLogMessage, {
    valid: [
      { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { orderId })") },
      { filename: SRC, code: withPrelude("logger.warn(OrderLogEvent.CheckoutRetried)") },
      { filename: SRC, code: withPrelude("logger.error(OrderLogEvent.CheckoutFailed, cause, { orderId })") },
      // a value of the enum type, and a choice between members
      { filename: SRC, code: withPrelude("declare const event: OrderLogEvent\nlogger.info(event)") },
      { filename: SRC, code: withPrelude("logger.info(retry ? OrderLogEvent.CheckoutRetried : OrderLogEvent.CheckoutFailed)") },
      // template literals and strings in the FIELDS are not the event
      { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { detail: `order ${orderId}` })") },
      // a receiver that is not the Logger port is not judged, however it is spelled
      { filename: SRC, code: withPrelude("fake.info(`built ${orderId}`)\nconsole.log('x')\nother.info('x')") },
      { filename: SRC, code: "const label = `Cart ${id}`" },
    ],
    invalid: [
      { filename: SRC, code: withPrelude("logger.info(`Checkout ${orderId} failed`)"), errors: [{ messageId: "notEvent" }] },
      { filename: SRC, code: withPrelude("logger.info('order.checkout.failed')"), errors: [{ messageId: "notEvent" }] },
      { filename: SRC, code: withPrelude("logger.warn('a' + orderId)"), errors: [{ messageId: "notEvent" }] },
      { filename: SRC, code: withPrelude("declare const event: string\nlogger.info(event)"), errors: [{ messageId: "notEvent" }] },
      // an enum that is not a log-events enum
      { filename: SRC, code: withPrelude("logger.info(OrderStatus.Open)"), errors: [{ messageId: "wrongHome" }] },
      // a renamed receiver and a property injection are still the Logger
      { filename: SRC, code: withPrelude("const sink = logger\nsink.info(`Checkout ${orderId}`)"), errors: [{ messageId: "notEvent" }] },
      { filename: SRC, code: withPrelude("class C { constructor(private readonly journal: Logger) {}\n run() { this.journal.info('x') } }"), errors: [{ messageId: "notEvent" }] },
      // specs are not exempt
      { filename: SPEC, code: withPrelude("logger.info('x')"), errors: [{ messageId: "notEvent" }] },
    ],
  })
})

test("OBSERVABILITY-5: a failure log carries the exception's code, not only its wording", () => {
  tester.run("no-error-wording-as-log-identity", noErrorWordingAsLogIdentity, {
    valid: [
      // the code rides with the message
      { filename: SRC, code: withPrelude("try { run() } catch (error) { logger.error(OrderLogEvent.CheckoutFailed, error, { code: error.code, detail: error.message }) }") },
      // the caught error passed whole is the cause: the adapter serializes it
      { filename: SRC, code: withPrelude("try { run() } catch (error) { logger.error(OrderLogEvent.CheckoutFailed, error, { detail: error.message }) }") },
      // no wording at all
      { filename: SRC, code: withPrelude("try { run() } catch (error) { logger.error(OrderLogEvent.CheckoutFailed, cause, { orderId }) }") },
      // outside a catch the rule has nothing to say
      { filename: SRC, code: withPrelude("logger.error(OrderLogEvent.CheckoutFailed, cause, { detail: err.message })") },
      // a receiver that is not the Logger port
      { filename: SRC, code: withPrelude("try { run() } catch (error) { fake.info(`failed ${error.message}`) }") },
    ],
    invalid: [
      { filename: SRC, code: withPrelude("try { run() } catch (error) { logger.error(OrderLogEvent.CheckoutFailed, cause, { detail: error.message }) }"), errors: [{ messageId: "wordingOnly" }] },
      { filename: SRC, code: withPrelude("try { run() } catch (error) { logger.warn(OrderLogEvent.CheckoutRetried, { detail: String(error) }) }"), errors: [{ messageId: "wordingOnly" }] },
      { filename: SRC, code: withPrelude("try { run() } catch (error) { logger.warn(OrderLogEvent.CheckoutRetried, { detail: `failed: ${error}` }) }"), errors: [{ messageId: "wordingOnly" }] },
      // a renamed receiver is still the Logger
      { filename: SRC, code: withPrelude("const sink = logger\ntry { run() } catch (error) { sink.warn(OrderLogEvent.CheckoutRetried, { detail: error.message }) }"), errors: [{ messageId: "wordingOnly" }] },
      // specs are not exempt
      { filename: SPEC, code: withPrelude("try { run() } catch (error) { logger.warn(OrderLogEvent.CheckoutRetried, { detail: error.message }) }"), errors: [{ messageId: "wordingOnly" }] },
    ],
  })
})
