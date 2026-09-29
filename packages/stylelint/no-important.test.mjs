import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file) => lintRule("no-important", code, file)

test("refuses !important in a declaration, in every stylesheet kind including brand.css", async () => {
  for (const file of Object.values(FILES)) {
    const warnings = await rule(".a { color: var(--accent) !important; }", file)
    assert.equal(warnings.length, 1, file)
    assert.match(warnings[0].text, /!important/)
  }
})

test("refuses importance on an @apply utility, in either Tailwind spelling", async () => {
  assert.equal((await rule(".a { @apply !p-4 text-sm; }")).length, 1)
  assert.equal((await rule(".a { @apply p-4!; }")).length, 1)
})

test("accepts a cascade that needs no force", async () => {
  assert.deepEqual(await rule(".a { color: var(--accent); @apply p-4; }"), [])
})
