import assert from "node:assert/strict"
import test from "node:test"
import { checkRoutedSources, evaluateQualityGate, rejectSecretArguments, scannerToken } from "./check.mjs"

const measures = { bugs: 0, vulnerabilities: 0, code_smells: 0, new_bugs: 0, new_vulnerabilities: 0, new_code_smells: 0, reliability_rating: 1, security_rating: "A", sqale_rating: 1, security_hotspots_reviewed: 100, duplicated_lines_density: 2, new_duplicated_lines_density: 1, coverage: 88, new_coverage: 95 }

test("normalizes be/fe aliases and validates every routed row", () => {
    assert.equal(checkRoutedSources([{ role: "be" }, { role: "fe" }, { role: "console" }]).ok, true)
    assert.equal(checkRoutedSources([{ role: "backend" }, { role: "fe" }, { role: "console" }, { role: "other" }]).ok, false)
})
test("accepts strict gate only with complete evidence and exact SHA", () => assert.equal(evaluateQualityGate({ status: "OK", analysis: { sha: "abc" }, measures }, { analysisSha: "abc" }).ok, true))
test("fails missing status, SHA and required metric", () => {
    const result = evaluateQualityGate({ measures: { ...measures, coverage: undefined } }, { analysisSha: "abc" })
    assert.equal(result.ok, false); assert.deepEqual(result.failures.map((item) => item.metric).sort(), ["analysis_sha", "coverage", "quality_gate"])
})
test("an unsupported required metric remains incomplete", () => {
    const result = evaluateQualityGate({ status: "OK", analysis: { sha: "abc" }, measures: {}, capabilities: { coverage: false } }, { analysisSha: "abc" })
    assert.equal(result.ok, false)
    assert(result.failures.some((item) => item.metric === "coverage"))
})
test("null, empty and non-numeric strict metrics cannot pass", () => {
    const broken = {...measures, bugs: null, vulnerabilities: "", duplicated_lines_density: "not-a-number"}
    const result = evaluateQualityGate({status: "OK", analysis: {sha: "abc"}, measures: broken}, {analysisSha: "abc"})
    assert.equal(result.ok, false)
    assert(result.failures.some((item) => item.metric === "bugs"))
    assert(result.failures.some((item) => item.metric === "vulnerabilities"))
    assert(result.failures.some((item) => item.metric === "duplicated_lines_density"))
})
test("never accepts secret command arguments", () => assert.throws(() => rejectSecretArguments(["--token=abc"])))
test("reads analysis token only from environment or stdin", () => { assert.equal(scannerToken({ env: { SONAR_TOKEN: "x" } }), "x"); assert.equal(scannerToken({ env: {}, stdin: "y\n" }), "y") })
