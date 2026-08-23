#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const sourceRoot = resolve(trustRoot, "..")

const roles = {
    be: {
        gateRouter: "runtime/gates/be/lints/context.md",
        gateRoot: "runtime/gates/be/lints",
        packageName: "@starci/eslint-canon-be",
    },
    fe: {
        gateRouter: "runtime/gates/fe/lints/context.md",
        gateRoot: "runtime/gates/fe/lints",
        packageName: "@starci/eslint-canon-fe",
    },
}

function normalizedLines(text) {
    return text.replace(/\r\n?/g, "\n").split("\n")
}

export function parseGateRouter(text) {
    const rows = []
    for (const line of normalizedLines(text)) {
        if (!line.startsWith("| `")) continue
        const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
        if (cells.length !== 4) continue
        const rule = cells[0].match(/^`([^`]+)`$/)?.[1]
        if (!rule || rule === "Emitted rule") continue
        const loads = [...cells[3].matchAll(/`([^`]+\/context\.md)`/g)].map((match) => match[1])
        rows.push({
            rule,
            situation: cells[1],
            trigger: cells[2],
            loads,
        })
    }
    return rows
}

function workspaceRouteRoots(role) {
    const workspaceRoot = join(sourceRoot, ".workspaces", "local", "routes")
    if (!existsSync(workspaceRoot)) return []
    const roots = []
    for (const project of readdirSync(workspaceRoot, { withFileTypes: true })) {
        if (!project.isDirectory()) continue
        const configPath = join(workspaceRoot, project.name, role, "config.json")
        if (!existsSync(configPath)) continue
        try {
            const config = JSON.parse(readFileSync(configPath, "utf8"))
            const gitRoot = config?.repository?.gitRoot
            if (typeof gitRoot === "string" && existsSync(join(gitRoot, "package.json"))) roots.push(gitRoot)
        } catch {
            // Route validity belongs to workspace readiness. One malformed sibling must not hide a valid route.
        }
    }
    return roots
}

function resolvePackage(packageName, role) {
    const roots = [sourceRoot, ...workspaceRouteRoots(role)]
    for (const root of roots) {
        try {
            const require = createRequire(join(root, "package.json"))
            return require.resolve(packageName)
        } catch {
            // Try the next verified checkout candidate.
        }
    }
    return null
}

function duplicates(values) {
    const counts = new Map()
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
    return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value)
}

export async function checkRole(role, options = {}) {
    const config = roles[role]
    if (!config) return { ok: false, failures: [`unknown role: ${role}`] }
    const failures = []
    const routerPath = join(trustRoot, config.gateRouter)
    const rows = parseGateRouter(readFileSync(routerPath, "utf8"))
    if (!rows.length) failures.push(`${config.gateRouter}: no emitted-rule rows`)

    for (const duplicate of duplicates(rows.map((row) => row.rule))) {
        failures.push(`${config.gateRouter}: duplicate emitted rule ${duplicate}`)
    }
    for (const row of rows) {
        if (!row.situation || row.situation === "—") failures.push(`${row.rule}: missing situation identity`)
        if (!row.trigger) failures.push(`${row.rule}: missing refusal trigger`)
        if (!row.loads.length) failures.push(`${row.rule}: missing gate runtime target`)
        for (const load of row.loads) {
            const target = join(trustRoot, config.gateRoot, load)
            if (!existsSync(target)) failures.push(`${row.rule}: missing gate target ${target}`)
        }
    }

    const packageEntry = options.packageEntry ?? resolvePackage(config.packageName, role)
    if (!packageEntry) {
        failures.push(`${config.packageName}: package is not resolvable from Source or a routed ${role} checkout`)
        return { ok: false, role, rows, failures }
    }
    const plugin = options.plugin ?? await import(pathToFileURL(packageEntry).href)
    const machineRules = Object.keys(plugin.rules ?? {}).sort()
    const routedRules = rows.map((row) => row.rule).sort()
    for (const rule of machineRules.filter((rule) => !routedRules.includes(rule))) {
        failures.push(`${rule}: published machine rule has no gate route`)
    }
    for (const rule of routedRules.filter((rule) => !machineRules.includes(rule))) {
        failures.push(`${rule}: gate route has no published machine rule`)
    }
    if (!plugin.ruleOwners || typeof plugin.ruleOwners !== "object") {
        failures.push(`${config.packageName}: package exposes no ruleOwners accountability map`)
    } else {
        for (const rule of machineRules) {
            if (!plugin.ruleOwners[rule]) failures.push(`${rule}: published machine rule has no law owner`)
        }
    }
    return { ok: failures.length === 0, role, rows, machineRules, packageEntry, machineTestProof: "unmeasured external", failures }
}

function parseArgs(argv) {
    if (argv.length !== 1 || !["--be", "--fe", "--all"].includes(argv[0])) return null
    return argv[0] === "--all" ? ["be", "fe"] : [argv[0].slice(2)]
}

async function main(argv) {
    const selected = parseArgs(argv)
    if (!selected) {
        console.error("Usage: node runtime/machines/rule-bindings/check.mjs (--be|--fe|--all)")
        return 2
    }
    let failed = false
    for (const role of selected) {
        const result = await checkRole(role)
        if (!result.ok) {
            failed = true
            console.error(`${role}: rule-binding parity failed`)
            for (const failure of result.failures) console.error(`- ${failure}`)
        } else {
            console.log(`${role}: ${result.rows.length} gate route(s) match ${result.machineRules.length} published rule(s); machine-test proof ${result.machineTestProof}`)
        }
    }
    return failed ? 1 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = await main(process.argv.slice(2))
}
