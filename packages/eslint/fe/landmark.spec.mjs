import assert from "node:assert/strict"
import test from "node:test"
import { LANDMARK_BRANCHES, rules } from "./landmark.mjs"

test("landmark ownership stays with the named branch and declares no rule", () => {
  assert.equal(LANDMARK_BRANCHES.has("Main"), true)
  assert.deepEqual(rules, {})
})
