import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file) => lintRule("raw-brand-value", code, file)

test("refuses a hex colour, a colour function and a pixel length outside brand.css", async () => {
  for (const file of [FILES.module, FILES.css, FILES.globals]) {
    assert.equal((await rule(".a { color: #ff0000; }", file)).length, 1, `hex in ${file}`)
    assert.equal((await rule(".a { color: rgb(0 0 0); }", file)).length, 1, `rgb in ${file}`)
    assert.equal((await rule(".a { color: hsl(10 20% 30%); }", file)).length, 1, `hsl in ${file}`)
    assert.equal((await rule(".a { color: oklch(50% 0.1 20); }", file)).length, 1, `oklch in ${file}`)
    assert.equal((await rule(".a { width: 12px; }", file)).length, 1, `px in ${file}`)
  }
})

test("reports a declaration once, colour before length", async () => {
  const warnings = await rule(".a { border: 1px solid #fff; }")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /raw colour value/)
})

test("reads custom-property values too", async () => {
  assert.equal((await rule(".a { --gap: 4px; }")).length, 1)
})

test("allows every raw value inside brand.css", async () => {
  assert.deepEqual(await rule(":root { --accent: #7547ff; --background: oklch(97% 0 0); --gap: 4px; }", FILES.brand), [])
})

test("does not take a url fragment or a token reference for a raw value", async () => {
  assert.deepEqual(await rule(".a { background: url(#add); color: var(--accent); margin: 0 0 var(--grammar-row-gap); }"), [])
})

test("does not take a longer word or a rem length for a raw value", async () => {
  assert.deepEqual(await rule(".a { width: 12rem; animation-name: pxfade; }"), [])
})
