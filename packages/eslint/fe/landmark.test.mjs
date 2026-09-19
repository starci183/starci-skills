import assert from "node:assert/strict"
import test from "node:test"
import { isPageTierFile, isRouteFile, isRouteLayoutFile, LANDMARK_BRANCHES, rules } from "./landmark.mjs"

test("landmark helpers recognize route and page ownership", () => {
  assert.equal(isRouteLayoutFile("D:/repo/src/app/en/layout.tsx"), true)
  assert.equal(isRouteFile("D:/repo/src/app/en/dashboard/page.tsx"), true)
  assert.equal(isPageTierFile("D:/repo/src/components/pages/Dashboard/component.tsx"), true)
  assert.equal(LANDMARK_BRANCHES.has("Main"), true)
  assert.deepEqual(rules, {})
})
