#!/usr/bin/env node

import { existsSync } from "node:fs"
import { resolve } from "node:path"

export const REQUIRED_ROLES = ["backend", "frontend", "console"]
export const ROLE_ALIASES = Object.freeze({ be: "backend", backend: "backend", fe: "frontend", frontend: "frontend", console: "console" })
export const QUALITY_POLICY = Object.freeze({
    zero: ["bugs", "vulnerabilities", "code_smells", "new_bugs", "new_vulnerabilities", "new_code_smells"],
    ratings: ["reliability_rating", "security_rating", "sqale_rating"],
    maximums: { security_hotspots_reviewed: 100, duplicated_lines_density: 3, new_duplicated_lines_density: 3 },
    minimums: { security_hotspots_reviewed: 100, coverage: 80, new_coverage: 90 },
})

export function checkRoutedSources(routes, roles = REQUIRED_ROLES) {
    const rows = Array.isArray(routes) ? routes : Object.entries(routes ?? {}).map(([role, value]) => ({ role, ...value }))
    const normalized = rows.map((row) => ({ ...row, role: ROLE_ALIASES[String(row.role ?? row.kind ?? row.name ?? "").toLowerCase()] ?? String(row.role ?? "").toLowerCase() }))
    const counts = Object.fromEntries(roles.map((role) => [role, normalized.filter((row) => row.role === role).length]))
    const missing = roles.filter((role) => counts[role] === 0)
    return { ok: missing.length === 0 && normalized.every((row) => roles.includes(row.role)), missing, invalid: normalized.filter((row) => !roles.includes(row.role)), counts, sources: normalized }
}

function metricValue(measures, key) { return measures[key]?.value ?? measures[key] }
export function evaluateQualityGate(gate, options = {}) {
    const policy = { ...QUALITY_POLICY, ...(options.policy ?? {}) }
    const measures = gate?.measures ?? gate?.component?.measures ?? {}
    const failures = []
    const requireMetric = (key, expected) => {
        const current = metricValue(measures, key)
        if (current === undefined || current === null || String(current).trim() === "") {
            failures.push({ metric: key, expected, actual: null, reason: "missing required evidence" })
            return undefined
        }
        return current
    }
    for (const key of policy.zero ?? []) { const current = requireMetric(key, 0); if (current !== undefined && Number(current) !== 0) failures.push({ metric: key, expected: 0, actual: current }) }
    const isRatingA = (current) => String(current).toUpperCase() === "A" || Number(current) === 1
    for (const key of policy.ratings ?? []) { const current = requireMetric(key, "A"); if (current !== undefined && !isRatingA(current)) failures.push({ metric: key, expected: "A", actual: current }) }
    for (const [key, maximum] of Object.entries(policy.maximums ?? {})) { const current = requireMetric(key, `<=${maximum}`); if (current !== undefined && (!Number.isFinite(Number(current)) || Number(current) > maximum)) failures.push({ metric: key, expected: `<=${maximum}`, actual: current }) }
    for (const [key, minimum] of Object.entries(policy.minimums ?? {})) { const current = requireMetric(key, `>=${minimum}`); if (current !== undefined && (!Number.isFinite(Number(current)) || Number(current) < minimum)) failures.push({ metric: key, expected: `>=${minimum}`, actual: current }) }
    for (const key of policy.ratings ?? []) { const newKey = `new_${key}`; if (measures[newKey] !== undefined) { const current = metricValue(measures, newKey); if (!isRatingA(current)) failures.push({ metric: newKey, expected: "A", actual: current }) } }
    const analysisSha = options.analysisSha ?? gate?.analysisSha
    const returnedSha = gate?.analysis?.sha ?? gate?.sha
    if (!analysisSha || analysisSha !== returnedSha) failures.push({ metric: "analysis_sha", expected: analysisSha ?? "provided", actual: returnedSha ?? null })
    const gateStatus = gate?.status ?? gate?.projectStatus?.status
    if (gateStatus !== "OK") failures.push({ metric: "quality_gate", expected: "OK", actual: gateStatus ?? null, reason: "missing supported evidence" })
    return { ok: failures.length === 0, failures, analysisSha: returnedSha ?? null }
}

export function scannerToken({ env = process.env, stdin = "" } = {}) {
    const token = env.SONAR_TOKEN || String(stdin).trim()
    if (!token) throw new Error("analysis token is required through SONAR_TOKEN or stdin")
    return token
}

export function rejectSecretArguments(argv = []) {
    if (argv.some((arg) => /(?:token|password|secret|credential)=/i.test(arg) || /^(?:--)?(?:token|password|secret)$/i.test(arg))) throw new Error("secrets must not be supplied as command-line arguments")
}

export function checkRepositoryRoot(root) { const absolute = resolve(root); return { ok: existsSync(absolute), root: absolute } }

if (process.argv[1]?.endsWith("check.mjs")) { try { rejectSecretArguments(process.argv.slice(2)); const result = checkRepositoryRoot(process.argv[2] ?? "."); console.log(result.ok ? "sonar assurance: ready" : "sonar assurance: repository missing"); process.exitCode = result.ok ? 0 : 1 } catch (error) { console.error(error.message); process.exitCode = 2 } }
