#!/usr/bin/env node

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    return value
}

export function planHash(plan) {
    const content = { ...plan }
    delete content.planHash
    return createHash("sha256").update(`${JSON.stringify(canonical(content))}\n`).digest("hex")
}

export function checkPlan(plan, options = {}) {
    const failures = []
    const patternRoot = options.patternRoot ?? join(trustRoot, "compilers", "patterns", "be")
    const files = new Set((plan.files ?? []).map((file) => file.path))
    const covered = new Set()
    if (!/^[a-f0-9]{12,64}$/.test(plan.sourceRevision ?? "")) failures.push("sourceRevision is absent or invalid")
    const expectedHash = planHash(plan)
    if (plan.planHash !== expectedHash) failures.push(`planHash mismatch; expected ${expectedHash}`)
    for (const binding of plan.patternBindings ?? []) {
        const contextPath = join(patternRoot, String(binding.module ?? ""), "context.md")
        if (!existsSync(contextPath)) {
            failures.push(`${binding.module}: pattern module does not exist`)
            continue
        }
        const law = readFileSync(contextPath, "utf8")
        for (const situation of binding.situations ?? []) {
            if (!new RegExp(`\\b${String(situation).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(law)) {
                failures.push(`${binding.module}: unknown situation ${situation}`)
            }
        }
        for (const path of binding.paths ?? []) {
            if (!files.has(path)) failures.push(`${binding.module}: binding path is outside files: ${path}`)
            else covered.add(path)
        }
    }
    for (const path of files) if (!covered.has(path)) failures.push(`${path}: planned file has no pattern binding`)
    return { ok: failures.length === 0, failures, expectedHash }
}

function main(argv) {
    if (argv.length !== 1 || !existsSync(resolve(argv[0]))) {
        console.error("Usage: node .claude/runtime/machines/backend-plan/check.mjs <plan.json>")
        return 2
    }
    const plan = JSON.parse(readFileSync(resolve(argv[0]), "utf8"))
    const result = checkPlan(plan)
    if (!result.ok) {
        console.error("backend plan semantic check failed")
        for (const failure of result.failures) console.error(`- ${failure}`)
        return 1
    }
    console.log(`backend plan semantic check passed — ${result.expectedHash}`)
    return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2))
