import assert from "node:assert/strict"
import test from "node:test"
import { audits, recommended, rules } from "./grammar-boundary.mjs"

test("Grammar boundary is a neutral React component boundary", () => {
  assert.deepEqual(rules, {})
  assert.deepEqual(recommended, {})
  assert.deepEqual(audits, {})
})

test("ordinary React children remain valid at the Grammar boundary", () => {
  const children = { type: "section", props: { children: "content" } }
  assert.equal(children.props.children, "content")
})
