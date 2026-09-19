import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  projectionListenerContract,
  noDynamicProjectionGroupId,
  projectionRecomputeMustUpsert,
} from "./cdc.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const FILE = "D:/repo/src/modules/projections/x/x-projection.listener.ts"
const SERVICE_FILE = "D:/repo/src/modules/projections/x/x-projection.service.ts"

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

test("a projection's groupId is a constant, never computed at boot", () => {
  tester.run("no-dynamic-projection-group-id", noDynamicProjectionGroupId, {
    valid: [{
      filename: FILE,
      code: "class X extends AbstractProjectionListener<T> { groupId = 'user-xp-projection' }",
    }],
    invalid: [{
      filename: FILE,
      code: "class X extends AbstractProjectionListener<T> { groupId = `user-xp-${Date.now()}` }",
      errors: [{ messageId: "dynamic" }],
    }],
  })
})

test("a projection recomputes by UPSERT from source, never by applying a delta", () => {
  tester.run("projection-recompute-must-upsert", projectionRecomputeMustUpsert, {
    valid: [{
      filename: SERVICE_FILE,
      code: "class X { async recompute({ userId }) { await this.manager.query('INSERT INTO t (id, v) SELECT $1, sum(x) FROM y ON CONFLICT (id) DO UPDATE SET v = EXCLUDED.v', [userId]) } }",
    }],
    invalid: [{
      filename: SERVICE_FILE,
      code: "class X { async recompute({ userId, amount }) { await this.manager.query('UPDATE t SET v = v + $2 WHERE id = $1', [userId, amount]) } }",
      errors: [{ messageId: "upsert" }, { messageId: "delta" }],
    }],
  })
})
