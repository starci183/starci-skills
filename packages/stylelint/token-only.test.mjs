import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file, options) => lintRule("token-only", code, file, options)

test("accepts grammar tokens, family tokens, math over tokens and neutral keywords", async () => {
  const code = `
.card {
  color: var(--accent);
  background-color: var(--surface);
  padding: var(--grammar-inline-gap);
  gap: calc(var(--grammar-row-gap) * 2);
  margin: 0 auto;
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  border-color: transparent;
  outline: none;
  width: 100%;
  box-shadow: var(--overlay-shadow);
  background: var(--surface) url(#add);
}
`
  assert.deepEqual(await rule(code), [])
})

test("refuses a length, number or word written in place for spacing, radius and typography", async () => {
  const code = `
.card {
  gap: 1rem;
  border-radius: 0.5rem;
  font-weight: 700;
  line-height: 1.5;
}
`
  const warnings = await rule(code)
  assert.equal(warnings.length, 4)
  assert.match(warnings[0].text, /gap: 1rem.*spacing/)
  assert.match(warnings[1].text, /radius/)
  assert.match(warnings[2].text, /typography/)
})

test("refuses a named colour for a colour property and inside a shorthand", async () => {
  const warnings = await rule(".card { color: white; border: 0 solid red; background: linear-gradient(var(--accent), navy); }")
  assert.equal(warnings.length, 3)
  assert.match(warnings[0].text, /colour value/)
  assert.match(warnings[1].text, /named colour `red`/)
  assert.match(warnings[2].text, /named colour `navy`/)
})

test("refuses a var() that names a token the grammar does not publish", async () => {
  const warnings = await rule(".card { color: var(--nv-ink); --local: var(--nv-paper); }")
  assert.equal(warnings.length, 2)
  assert.match(warnings[0].text, /var\(--nv-ink\).*does not publish/)
})

test("judges the fallback of a var() like any other value", async () => {
  const warnings = await rule(".card { padding: var(--grammar-inline-gap, 1rem); margin: var(--grammar-row-gap, 0); }")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /padding/)
})

test("leaves hex, colour functions and px to raw-brand-value, so one span has one finding", async () => {
  assert.deepEqual(await rule(".card { color: #fff; background-color: rgb(0 0 0); border-radius: 8px; margin: 0 -12px; }"), [])
})

test("accepts a token the repository declared as an appToken, and refuses it otherwise", async () => {
  const code = ".card { color: var(--page-ink); }"
  assert.equal((await rule(code)).length, 1)
  assert.deepEqual(await rule(code, FILES.module, { appTokens: ["--page-ink"] }), [])
})

test("does not hold custom-property values or unrelated properties to a role", async () => {
  assert.deepEqual(await rule(".card { --row-index: 3; display: grid; z-index: 4; opacity: 0.5; }"), [])
})

test("applies to every stylesheet kind except the role check inside brand.css", async () => {
  assert.equal((await rule(".a { gap: 1rem; }", FILES.css)).length, 1)
  assert.equal((await rule(".a { gap: 1rem; }", FILES.globals)).length, 1)
  assert.deepEqual(await rule(":root { --gap: 1rem; }", FILES.brand), [])
})
