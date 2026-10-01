import assert from "node:assert/strict"
import test from "node:test"
import { lint, lintRule } from "./testing.mjs"

test("refuses stylelint-disable, -enable and -disable-next-line comments", async () => {
  for (const comment of ["stylelint-disable", "stylelint-disable starci/no-important", "stylelint-disable-next-line starci/no-important"]) {
    const warnings = await lintRule("no-inline-lint-config", `/* ${comment} */\n.a { color: var(--accent); }`)
    assert.equal(warnings.length, 1, comment)
  }
  // an enable closes a disable: both comments are findings
  const pair = await lintRule("no-inline-lint-config", "/* stylelint-disable */\n.a { color: var(--accent); }\n/* stylelint-enable */")
  assert.deepEqual(pair.map((warning) => warning.text.split("`")[1]), ["/* stylelint-disable */", "/* stylelint-enable */"])
})

test("a disable comment switches nothing off", async () => {
  for (const code of [
    "/* stylelint-disable */\n.a { color: #fff; }\n.b { color: var(--accent) !important; }",
    "/* stylelint-disable starci/raw-brand-value */\n.a { color: #fff; }\n/* stylelint-disable-next-line starci/no-important */\n.b { color: var(--accent) !important; }",
  ]) {
    const warnings = await lint(code)
    assert.equal(warnings.filter((warning) => warning.rule === "starci/raw-brand-value").length, 1, code)
    assert.equal(warnings.filter((warning) => warning.rule === "starci/no-important").length, 1, code)
  }
})

test("a disable sequence stylelint itself rejects fails the file at error", async () => {
  // stylelint 17 refuses an enable with nothing disabled and a disable inside a disable-all as a CssSyntaxError before any
  // rule runs; the file still fails, so nothing is switched off
  for (const code of [
    "/* stylelint-enable */\n.a { color: var(--accent); }",
    "/* stylelint-disable */\n.a { color: #fff; }\n/* stylelint-disable-next-line starci/no-important */\n.b { color: var(--accent) !important; }",
  ]) {
    const warnings = await lint(code)
    assert.ok(warnings.some((warning) => warning.rule === "CssSyntaxError" && warning.severity === "error"), code)
  }
})

test("accepts an ordinary comment", async () => {
  assert.deepEqual(await lintRule("no-inline-lint-config", "/* the card */\n.a { color: var(--accent); }"), [])
})
