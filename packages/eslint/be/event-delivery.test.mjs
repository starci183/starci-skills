import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { natsBridgeDeliveryContract, noCallSiteTransportOverride } from "./event-delivery.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const FILE = "D:/repo/src/modules/platform/event/nats/nats-bridge.service.ts"
const CALLER_FILE = "D:/repo/src/modules/ai/ping/classes/abstract-provider-ping.service.ts"

test("the NATS bridge filters origin and digest before local fan-out", () => {
  tester.run("nats-bridge-delivery-contract", natsBridgeDeliveryContract, {
    valid: [{
      filename: FILE,
      code: "if (parsed.id === this.instanceService.getId()) continue; await cache.get(parsed.digest); this.eventEmitter.emit(name, parsed.data)",
    }],
    invalid: [{
      filename: FILE,
      code: "this.eventEmitter.emit(name, parsed.data)",
      errors: [{ messageId: "origin" }, { messageId: "digest" }],
    }],
  })
})

test("transport is declared per event in config, never overridden at the call site", () => {
  tester.run("no-call-site-transport-override", noCallSiteTransportOverride, {
    valid: [{
      filename: CALLER_FILE,
      code: "this.eventEmitterService.emit({ event: EventName.Ping, payload: { status: 'ok' } })",
    }],
    invalid: [{
      filename: CALLER_FILE,
      code: "this.eventEmitterService.emit({ event: EventName.Ping, payload: { status: 'ok' }, options: { useLocal: true, useNats: false } })",
      errors: [{ messageId: "callsite" }],
    }],
  })
})
