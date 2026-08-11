import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { projectionListenerContract } from "./cdc.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const FILE = "D:/repo/src/modules/projections/x/x-projection.listener.ts"

test("projection listeners keep delivery mechanics in the shared base", () => {
  tester.run("projection-listener-contract", projectionListenerContract, {
    valid: [{
      filename: FILE,
      code: "class X extends AbstractProjectionListener<T> { groupId='x'; topics=['x']; deriveTargets() {}; recomputeTarget() {} }",
    }],
    invalid: [{
      filename: FILE,
      code: "class X { onModuleInit() {} }",
      errors: [
        { messageId: "base" },
        { messageId: "member" },
        { messageId: "member" },
        { messageId: "member" },
        { messageId: "member" },
        { messageId: "lifecycle" },
      ],
    }],
  })
})
