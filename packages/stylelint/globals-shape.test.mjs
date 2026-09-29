import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file = FILES.globals) => lintRule("globals-shape", code, file)

test("accepts imports, sources and alias tokens in a root, dark or theme block", async () => {
  const code = `
@import "tailwindcss";
@import url("./brand.css");
@source "../components";
:root { --page-x: var(--grammar-page-inset); }
:root, .dark { --page-y: calc(var(--grammar-region-gap) * 2); }
[data-theme="dark"] { --page-z: var(--grammar-row-gap); }
@theme inline { --color-brand: var(--accent); }
`
  assert.deepEqual(await rule(code), [])
})

test("refuses a class or element rule", async () => {
  const warnings = await rule(".card { color: var(--accent); }")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /\.card/)
  assert.equal((await rule("body { margin: 0; }")).length, 1)
})

test("refuses at-rules other than @import, @source and @theme", async () => {
  assert.equal((await rule("@layer base { :root { --a: var(--accent); } }")).length, 1)
  assert.equal((await rule("@media (min-width: 40rem) { :root { --a: var(--accent); } }")).length, 1)
  assert.equal((await rule("@custom-variant dark (&:where(.dark, .dark *));")).length, 1)
})

test("refuses a declaration that is not a custom property", async () => {
  const warnings = await rule(":root { color: var(--accent); }")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /not a token/)
  assert.equal((await rule("html { scroll-behavior: smooth; }")).length, 1)
})

test("refuses a token that writes a value instead of aliasing grammar tokens", async () => {
  const warnings = await rule(":root { --page-x: 3rem; --page-y: color-mix(in oklab, var(--accent), white); }")
  assert.equal(warnings.length, 2)
  assert.match(warnings[0].text, /writes a value/)
})

test("refuses a bare declaration at the top level", async () => {
  assert.equal((await rule("--x: var(--accent);")).length, 1)
})

test("only judges globals.css", async () => {
  assert.deepEqual(await rule(".card { color: var(--accent); }", FILES.module), [])
  assert.deepEqual(await rule(".card { color: var(--accent); }", FILES.css), [])
})
