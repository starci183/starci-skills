#!/usr/bin/env node
import { evaluateQualityGate, rejectSecretArguments } from "../machines/sonar-assurance/check.mjs"

function formBody(body = {}) { return new URLSearchParams(Object.entries(body).filter(([, value]) => value !== undefined)).toString() }

export async function sonarRequest({ baseUrl, path, method = "GET", token, fetchImpl = fetch, body }) {
    const headers = { Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}` }
    const init = { method, headers }
    if (body) { headers["content-type"] = "application/x-www-form-urlencoded"; init.body = formBody(body) }
    const response = await fetchImpl(new URL(path, baseUrl), init)
    let payload = {}
    if (typeof response.text === "function") {
        const raw = await response.text()
        if (raw.trim()) {
            try { payload = JSON.parse(raw) }
            catch { throw new Error(`Sonar API returned invalid JSON: ${response.status}`) }
        }
    } else if (typeof response.json === "function") payload = await response.json()
    if (!response.ok) {
        const detail = (payload.errors ?? []).map((item) => item.msg ?? item.message).filter(Boolean).join("; ")
        throw new Error(`Sonar API request failed: ${response.status}${detail ? ` (${detail})` : ""}`)
    }
    return payload
}

export const CONDITIONS = Object.freeze({
    new_violations: { error: "0", op: "GT" },
    new_reliability_rating: { error: "1", op: "GT" },
    new_security_rating: { error: "1", op: "GT" },
    new_maintainability_rating: { error: "1", op: "GT" },
    new_security_hotspots_reviewed: { error: "100", op: "LT" },
    new_duplicated_lines_density: { error: "3", op: "GT" },
    new_coverage: { error: "90", op: "LT" },
})

export async function reconcileGateOnly({ baseUrl, projectKey, token, fetchImpl = fetch }) {
    const listed = await sonarRequest({ baseUrl, path: "/api/qualitygates/list", token, fetchImpl })
    let gate = (listed.qualitygates ?? []).find((item) => item.name === "starci-strict")
    const created = !gate
    if (created) { gate = await sonarRequest({ baseUrl, path: "/api/qualitygates/create", method: "POST", token, fetchImpl, body: { name: "starci-strict" } }) }
    const current = await sonarRequest({ baseUrl, path: `/api/qualitygates/show?name=${encodeURIComponent("starci-strict")}`, token, fetchImpl })
    const existing = current.conditions ?? []
    const desiredKeys = new Set(Object.keys(CONDITIONS))
    for (const condition of existing) {
        if (!desiredKeys.has(condition.metric)) await sonarRequest({ baseUrl, path: "/api/qualitygates/delete_condition", method: "POST", token, fetchImpl, body: { id: condition.id } })
        else if (String(condition.error ?? condition.value ?? "") !== CONDITIONS[condition.metric].error || String(condition.op ?? "") !== CONDITIONS[condition.metric].op) await sonarRequest({ baseUrl, path: "/api/qualitygates/update_condition", method: "POST", token, fetchImpl, body: { id: condition.id, metric: condition.metric, ...CONDITIONS[condition.metric] } })
        desiredKeys.delete(condition.metric)
    }
    for (const metric of desiredKeys) await sonarRequest({ baseUrl, path: "/api/qualitygates/create_condition", method: "POST", token, fetchImpl, body: { gateName: "starci-strict", metric, ...CONDITIONS[metric] } })
    await sonarRequest({ baseUrl, path: "/api/qualitygates/select", method: "POST", token, fetchImpl, body: { gateName: "starci-strict", projectKey } })
    return { created, conditionCount: Object.keys(CONDITIONS).length }
}

export async function reconcileQualityGate({ baseUrl, projectKey, analysisSha, execute = false, env = process.env, fetchImpl = fetch, gateResponse }) {
    if (!execute) return { mode: "plan", projectKey, analysisSha, mutations: ["discover-or-create-starci-strict", "reconcile-declared-conditions", "associate-project"] }
    const adminToken = env.SONAR_ADMIN_TOKEN
    if (!adminToken) throw new Error("SONAR_ADMIN_TOKEN is required for execute mode")
    const reconciliation = await reconcileGateOnly({ baseUrl, projectKey, token: adminToken, fetchImpl })
    const status = gateResponse ?? await sonarRequest({ baseUrl, path: `/api/qualitygates/project_status?projectKey=${encodeURIComponent(projectKey)}`, token: adminToken, fetchImpl })
    const metricKeys = Object.keys({ bugs: 1, vulnerabilities: 1, code_smells: 1, new_bugs: 1, new_vulnerabilities: 1, new_code_smells: 1, reliability_rating: 1, security_rating: 1, sqale_rating: 1, new_reliability_rating: 1, new_security_rating: 1, new_maintainability_rating: 1, security_hotspots_reviewed: 1, new_security_hotspots_reviewed: 1, duplicated_lines_density: 1, new_duplicated_lines_density: 1, coverage: 1, new_coverage: 1 })
    const measuresResponse = await sonarRequest({ baseUrl, path: `/api/measures/component?component=${encodeURIComponent(projectKey)}&metricKeys=${metricKeys.join(",")}`, token: adminToken, fetchImpl })
    const analyses = await sonarRequest({ baseUrl, path: `/api/project_analyses/search?project=${encodeURIComponent(projectKey)}&ps=1`, token: adminToken, fetchImpl })
    const latest = analyses.analyses?.[0]
    const measures = Object.fromEntries((measuresResponse.component?.measures ?? []).map((item) => [item.metric, item.value ?? item.period?.value ?? item.periods?.[0]?.value]))
    const missingHotspotMeasures = ["security_hotspots_reviewed", "new_security_hotspots_reviewed"].filter((metric) => measures[metric] === undefined)
    if (missingHotspotMeasures.length > 0) {
        const hotspots = await sonarRequest({ baseUrl, path: `/api/hotspots/search?projectKey=${encodeURIComponent(projectKey)}&ps=1`, token: adminToken, fetchImpl })
        if (Number(hotspots.paging?.total) === 0) for (const metric of missingHotspotMeasures) measures[metric] = "100"
    }
    const gate = { status: status.status ?? status.projectStatus?.status, analysis: { sha: latest?.revision ?? latest?.sha }, measures }
    return { mode: "execute", projectKey, reconciliation, result: evaluateQualityGate(gate, { analysisSha }) }
}

if (process.argv[1]?.endsWith("sonar-quality-gate.mjs")) { try { rejectSecretArguments(process.argv.slice(2)); const execute = process.argv.includes("--execute"); console.log(execute ? "execute requires a controlled caller and SONAR_ADMIN_TOKEN" : "plan: discover-or-create-starci-strict, reconcile conditions, associate projects"); process.exitCode = execute ? 2 : 0 } catch (error) { console.error(error.message); process.exitCode = 2 } }
