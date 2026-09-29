import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file = FILES.module) => lintRule("no-token-redefinition", code, file)

test("refuses a CSS module that declares a semantic or family token", async () => {
  const warnings = await rule(".card { --accent: var(--foreground); --grammar-page-inset: var(--grammar-row-gap); --starci-core-anything: 1; }")
  assert.equal(warnings.length, 3)
  assert.match(warnings[0].text, /--accent.*CSS module/)
})

test("refuses the same redefinition in globals.css and any other stylesheet", async () => {
  assert.equal((await rule(":root { --muted: var(--foreground); }", FILES.globals)).length, 1)
  assert.equal((await rule(".a { --radius-md: var(--radius); }", FILES.css)).length, 1)
})

test("refuses registering a grammar token with @property", async () => {
  const warnings = await rule("@property --accent { syntax: '<color>'; inherits: true; initial-value: black; }")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /@property --accent/)
})

test("allows a local custom property that is not a grammar token", async () => {
  assert.deepEqual(await rule(".card { --row-index: 3; --card-offset: var(--grammar-row-gap); }"), [])
})

test("allows brand.css to set grammar tokens", async () => {
  assert.deepEqual(await rule(":root { --accent: #7547ff; --grammar-page-inset: 1rem; }", FILES.brand), [])
})
