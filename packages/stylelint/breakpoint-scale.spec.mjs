import assert from "node:assert/strict"
import test from "node:test"
import { lintRule } from "./testing.mjs"
import { BREAKPOINTS } from "./lib/vocabulary.generated.mjs"

const rule = (query) => lintRule("breakpoint-scale", `@media ${query} { [data-a] { color: var(--accent); } }`, "apps/web/src/app/x.css")

test("the scale is the grammar's own", () => {
  for (const width of ["30rem", "40rem", "48rem", "70rem"]) assert.ok(BREAKPOINTS.includes(width), width)
})

test("accepts a scale width in rem, or in px at 16px to the rem", async () => {
  assert.deepEqual(await rule("(min-width: 48rem)"), [])
  assert.deepEqual(await rule("(max-width: 30rem)"), [])
  assert.deepEqual(await rule("(min-width: 768px)"), [])
  assert.deepEqual(await rule("(min-width: 40rem) and (max-width: 70rem)"), [])
  assert.deepEqual(await rule("(width >= 48rem)"), [])
  assert.deepEqual(await rule("(40rem <= width < 70rem)"), [])
})

test("refuses a width off the scale, in either unit and either syntax", async () => {
  const warnings = await rule("(min-width: 700px)")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /700px.*not on the grammar's scale/)
  assert.equal((await rule("(max-width: 50rem)")).length, 1)
  assert.equal((await rule("(width >= 45rem)")).length, 1)
  assert.equal((await rule("(min-width: 40rem) and (max-width: 900px)")).length, 1)
})

test("does not judge features that are not widths", async () => {
  assert.deepEqual(await rule("(prefers-color-scheme: dark)"), [])
  assert.deepEqual(await rule("(prefers-reduced-motion: reduce)"), [])
  assert.deepEqual(await rule("(pointer: coarse), (forced-colors: active)"), [])
})
