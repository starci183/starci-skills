import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file) => lintRule("no-css-module", code, file)

test("refuses a *.module.css whatever it holds, including an empty one", async () => {
  for (const code of [".a { color: var(--accent); }", ":root { --row-index: 1; }", "/* nothing */"]) {
    const warnings = await rule(code, FILES.module)
    assert.equal(warnings.length, 1, code)
    assert.match(warnings[0].text, /Card\.module\.css.*CSS modules are banned/)
  }
})

test("does not judge any other stylesheet", async () => {
  for (const file of [FILES.css, FILES.globals, FILES.brand]) assert.deepEqual(await rule(":root { --a: 1; }", file), [])
})
