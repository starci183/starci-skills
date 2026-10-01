import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file = FILES.globals) => lintRule("globals-import-order", code, file)

test("accepts the standard order, with sources after the imports", async () => {
  const code = `
@import "tailwindcss";
@import "@heroui/styles/css";
@import "@starci/grammar/common.css";
@import "@starci/grammar/core.css";
@import "../modules/brand/brand.css";
@source "../components";
`
  assert.deepEqual(await rule(code), [])
  assert.deepEqual(await rule('@import "tailwindcss";\n@import url("@heroui/styles/css");'), [])
})

test("refuses an import that goes back a step", async () => {
  const warnings = await rule('@import "@starci/grammar/core.css";\n@import "tailwindcss";')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /tailwindcss.*comes after a grammar family stylesheet/)
  assert.equal((await rule('@import "../modules/brand/brand.css";\n@import "@starci/grammar/core.css";')).length, 1)
})

test("refuses an import that is none of the four", async () => {
  const warnings = await rule('@import "tailwindcss";\n@import "@nivo/ui/styles.css";')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /not one of the standard imports/)
  assert.equal((await rule('@import "@starci/grammar/unknown.css";')).length, 1)
})

test("refuses an import after an @source", async () => {
  const warnings = await rule('@import "tailwindcss";\n@source "../a";\n@import "@heroui/styles/css";')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /after an `@source`/)
})

test("only judges globals.css", async () => {
  assert.deepEqual(await rule('@import "other.css";', FILES.css), [])
})
