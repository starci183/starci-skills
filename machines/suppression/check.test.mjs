import assert from "node:assert/strict"
import test from "node:test"
import { scanText } from "./check.mjs"

test("refuses lint, type, coverage and Sonar suppression identities", () => {
    const findings = scanText(`
// eslint-disable-next-line rule
// @ts-ignore
/* istanbul ignore next */
// c8 ignore next
// v8 ignore next
doThing() // NOSONAR
`, "sample.ts")
    assert.deepEqual(findings.map((finding) => finding.identity), [
        "eslint", "typescript", "istanbul", "c8", "v8", "sonar",
    ])
})

test("ordinary source comments remain clean", () => {
    assert.deepEqual(scanText("// Explain the business reason.\nconst value = 1\n"), [])
})
