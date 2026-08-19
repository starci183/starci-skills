import assert from "node:assert/strict"
import test from "node:test"
import { CONDITIONS, reconcileQualityGate } from "./sonar-quality-gate.mjs"

test("plan is usable, value-free and makes no network call", async () => {
    let calls = 0
    const result = await reconcileQualityGate({ baseUrl: "http://sonar.invalid", projectKey: "be", analysisSha: "sha", fetchImpl: async () => { calls += 1 } })
    assert.equal(result.mode, "plan"); assert.equal(calls, 0); assert.match(result.mutations.join(" "), /associate-project/)
})

test("execute requires authority from environment and never logs it", async () => {
    await assert.rejects(() => reconcileQualityGate({ baseUrl: "http://sonar.invalid", projectKey: "be", analysisSha: "sha", execute: true, env: {} }), /SONAR_ADMIN_TOKEN/)
})

test("idempotent execution performs no condition mutations and uses form encoding", async () => {
    const calls = []
    const metrics = ["new_bugs", "new_vulnerabilities", "new_code_smells", "reliability_rating", "security_rating", "sqale_rating", "security_hotspots_reviewed", "duplicated_lines_density", "new_duplicated_lines_density", "coverage", "new_coverage"]
    const fetchImpl = async (url, options) => {
        calls.push({ url: String(url), options })
        if (String(url).includes("/list")) return { ok: true, json: async () => ({ qualitygates: [{ id: "1", name: "starci-strict" }] }) }
        if (String(url).includes("/show")) {
            return { ok: true, json: async () => ({ conditions: metrics.map((metric, index) => ({ id: String(index), metric, ...CONDITIONS[metric] })) }) }
        }
        if (String(url).includes("project_status")) return { ok: true, json: async () => ({ status: "OK" }) }
        if (String(url).includes("measures/component")) return { ok: true, json: async () => ({ component: { measures: [{ metric: "bugs", value: "0" }, { metric: "vulnerabilities", value: "0" }, { metric: "code_smells", value: "0" }, ...metrics.map((metric) => ({ metric, value: ["coverage", "new_coverage"].includes(metric) ? "90" : metric.includes("rating") ? "1" : metric.includes("duplicated") ? "1" : metric.includes("hotspots") ? "100" : "0" }))] } }) }
        if (String(url).includes("project_analyses/search")) return { ok: true, json: async () => ({ analyses: [{ revision: "sha" }] }) }
        return { ok: true, json: async () => ({}) }
    }
    const result = await reconcileQualityGate({ baseUrl: "http://sonar.invalid", projectKey: "be", analysisSha: "sha", execute: true, env: { SONAR_ADMIN_TOKEN: "operator-secret" }, fetchImpl })
    assert.equal(result.result.ok, true); assert.equal(result.reconciliation.created, false); assert.equal(calls.filter((call) => /create_condition|update_condition|delete_condition/.test(call.url)).length, 0)
    assert(calls.some((call) => call.url.includes("/api/measures/component") && call.url.includes("metricKeys=bugs,vulnerabilities")))
    assert(calls.some((call) => call.url.includes("/api/project_analyses/search") && call.url.includes("ps=1")))
    const association = calls.find((call) => call.url.includes("/select")); assert.match(association.options.headers["content-type"], /form-urlencoded/); assert.match(association.options.body, /projectKey=be/); assert.doesNotMatch(JSON.stringify(result), /operator-secret/)
})

test("reconciles create, update, delete and association calls", async () => {
    const paths = []; const bodies = []; const fetchImpl = async (url, options) => { paths.push(String(url)); if (options.body) bodies.push(options.body); if (String(url).includes("/list")) return { ok: true, json: async () => ({ qualitygates: [] }) }; if (String(url).includes("/show")) return { ok: true, json: async () => ({ conditions: [{ id: "old", metric: "old_metric", error: "1" }, { id: "dup", metric: "coverage", error: "1" }] }) }; if (String(url).includes("project_status")) return { ok: true, json: async () => ({ status: "OK" }) }; if (String(url).includes("measures/component")) return { ok: true, json: async () => ({ component: { measures: [] } }) }; if (String(url).includes("project_analyses/search")) return { ok: true, json: async () => ({ analyses: [] }) }; return { ok: true, json: async () => ({ id: "new" }) } }
    await reconcileQualityGate({ baseUrl: "http://sonar.invalid", projectKey: "fe", analysisSha: "sha", execute: true, env: { SONAR_ADMIN_TOKEN: "operator-secret" }, fetchImpl })
    assert(paths.some((path) => path.includes("/create"))); assert(paths.some((path) => path.includes("/update_condition"))); assert(paths.some((path) => path.includes("/delete_condition"))); assert(paths.some((path) => path.includes("/select"))); assert(bodies.some((body) => body.includes("op=GT") && body.includes("error=0")))
})
