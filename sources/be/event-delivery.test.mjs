import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { natsBridgeDeliveryContract } from "./event-delivery.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const FILE = "D:/repo/src/modules/platform/event/nats/nats-bridge.service.ts"

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
