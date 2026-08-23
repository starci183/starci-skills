import assert from "node:assert/strict";
import test from "node:test";
import {validateFacades} from "./validate-skill-facades.mjs";

test("semantic facades exactly cover the compact catalog without becoming skills", () => {
  const result = validateFacades();
  assert.deepEqual(result.failures, []);
  assert.equal(result.facadeCount, 7);
  assert.equal(result.skillCount, 20);
});
