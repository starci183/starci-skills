import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file = FILES.css) => lintRule("no-class-selector", code, file)

test("refuses a class selector, alone, compound, nested in a pseudo or in a list", async () => {
  assert.equal((await rule(".card { color: var(--accent); }")).length, 1)
  assert.equal((await rule("div.card > a { color: var(--accent); }")).length, 1)
  assert.equal((await rule(":is(.a, .b) { color: var(--accent); }")).length, 1)
  assert.equal((await rule(".a, .b { color: var(--accent); }")).length, 2)
  assert.match((await rule(".sign-in-card { gap: 0; }"))[0].text, /\.sign-in-card.*class selector/)
})

test("accepts element, attribute and pseudo selectors, and a dot inside an attribute value", async () => {
  const code = `
a { color: var(--link); }
[data-state="open"] { color: var(--accent); }
button:hover { color: var(--accent); }
@keyframes spin { 50.5% { opacity: 0.5; } }
`
  assert.deepEqual(await rule(code), [])
  assert.deepEqual(await rule('a[href$=".pdf"], a:hover { color: var(--link); }'), [])
})

test("leaves globals.css, brand.css and modules to their own rules", async () => {
  for (const file of [FILES.globals, FILES.brand, FILES.module]) assert.deepEqual(await rule(".dark { --a: 1; }", file), [])
})
