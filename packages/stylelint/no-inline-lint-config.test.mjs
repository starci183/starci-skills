import assert from "node:assert/strict"
import test from "node:test"
import { lint, lintRule } from "./testing.mjs"

test("refuses stylelint-disable, -enable and -disable-next-line comments", async () => {
  for (const comment of ["stylelint-disable", "stylelint-enable", "stylelint-disable-next-line starci/no-important"]) {
    const warnings = await lintRule("no-inline-lint-config", `/* ${comment} */\n.a { color: var(--accent); }`)
    assert.equal(warnings.length, 1, comment)
  }
})

test("a disable comment switches nothing off", async () => {
  const code = "/* stylelint-disable */\n.a { color: #fff; }\n/* stylelint-disable-next-line starci/no-important */\n.b { color: var(--accent) !important; }"
  const warnings = await lint(code)
  assert.equal(warnings.filter((warning) => warning.rule === "starci/raw-brand-value").length, 1)
  assert.equal(warnings.filter((warning) => warning.rule === "starci/no-important").length, 1)
})

test("accepts an ordinary comment", async () => {
  assert.deepEqual(await lintRule("no-inline-lint-config", "/* the card */\n.a { color: var(--accent); }"), [])
})
