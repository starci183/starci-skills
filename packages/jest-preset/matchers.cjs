"use strict"

/**
 * Outcome matchers, registered by the `unit` project's `setupFilesAfterEnv` (nowhere else).
 *
 * They match the platform `Outcome<V, C>` structurally: `{ kind: "ok", value }` or `{ kind: "refused", code, params? }`.
 * `expect(outcome).toBeRefused("STOCK_EXHAUSTED")` (or `{ code, params }`) and `expect(outcome).toSucceedWith(value)`.
 */

const isOutcome = (received) => typeof received === "object" && received !== null && (received.kind === "ok" || received.kind === "refused")

const notOutcome = (utils, received) => `expected an Outcome ({ kind: "ok" | "refused" }), received ${utils.printReceived(received)}`

const matchers = {
  toBeRefused(received, reason) {
    if (!isOutcome(received)) return { pass: false, message: () => notOutcome(this.utils, received) }
    const expected = typeof reason === "string" ? { code: reason } : reason
    const pass =
      received.kind === "refused" &&
      received.code === expected.code &&
      (!("params" in expected) || this.equals(received.params, expected.params))
    return {
      pass,
      message: () =>
        pass
          ? `expected the outcome not to be refused with ${this.utils.printExpected(expected)}`
          : `expected the outcome to be refused with ${this.utils.printExpected(expected)}, received ${this.utils.printReceived(received)}`,
    }
  },
  toSucceedWith(received, value) {
    if (!isOutcome(received)) return { pass: false, message: () => notOutcome(this.utils, received) }
    const pass = received.kind === "ok" && this.equals(received.value, value)
    return {
      pass,
      message: () =>
        pass
          ? `expected the outcome not to succeed with ${this.utils.printExpected(value)}`
          : `expected the outcome to succeed with ${this.utils.printExpected(value)}, received ${this.utils.printReceived(received)}`,
    }
  },
}

if (typeof expect !== "undefined" && typeof expect.extend === "function") expect.extend(matchers)

module.exports = { matchers }
