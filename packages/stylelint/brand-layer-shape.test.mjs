import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file = FILES.brand) => lintRule("brand-layer-shape", code, file)

test("accepts a light block and a dark block with the same tokens", async () => {
  const code = `
:root { color-scheme: light; --accent: #7547ff; --background: oklch(97% 0 0); }
.dark { color-scheme: dark; --accent: #9b7bff; --background: oklch(20% 0 0); }
`
  assert.deepEqual(await rule(code), [])
})

test("accepts the dark block as a media query or a data-theme selector", async () => {
  assert.deepEqual(await rule(":root { --accent: #fff; } @media (prefers-color-scheme: dark) { :root { --accent: #000; } }"), [])
  assert.deepEqual(await rule(':root { --accent: #fff; } [data-theme="dark"] { --accent: #000; }'), [])
})

test("refuses a file with no dark block", async () => {
  const warnings = await rule(":root { --accent: #fff; }")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /no dark block/)
})

test("refuses a token that has one theme only, either way round", async () => {
  const dropped = await rule(":root { --accent: #fff; --muted: #888; } .dark { --accent: #000; }")
  assert.equal(dropped.length, 1)
  assert.match(dropped[0].text, /--muted.*no dark value/)
  const added = await rule(":root { --accent: #fff; } .dark { --accent: #000; --muted: #888; }")
  assert.equal(added.length, 1)
  assert.match(added[0].text, /--muted.*no light value/)
})

test("refuses a token the grammar does not publish", async () => {
  const warnings = await rule(":root { --nv-ink: #fff; } .dark { --nv-ink: #000; --accent: #111; } :root { --accent: #eee; }")
  assert.equal(warnings.length, 2)
  assert.match(warnings[0].text, /--nv-ink.*not a token the grammar publishes/)
})

test("refuses a selector, a property or an at-rule that is not the brand layer", async () => {
  assert.equal((await rule(".card { --accent: #fff; } :root { --accent: #fff; } .dark { --accent: #000; }")).length, 1)
  assert.equal((await rule(":root { color: red; --accent: #fff; } .dark { --accent: #000; }")).length, 1)
  assert.equal((await rule("@import \"x.css\"; :root { --accent: #fff; } .dark { --accent: #000; }")).length, 1)
})

test("only judges brand.css", async () => {
  assert.deepEqual(await rule(".card { color: red; }", FILES.module), [])
  assert.deepEqual(await rule(":root { --nv-ink: #fff; }", FILES.globals), [])
})
