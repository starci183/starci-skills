#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ignoredDirectories = new Set([
    ".git", ".next", ".turbo", "coverage", "dist", "node_modules", "out",
])
const governedExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"])
const refusals = [
    { identity: "eslint", pattern: /eslint-(?:disable|enable)(?:-next-line|-line)?/ },
    { identity: "typescript", pattern: /@ts-(?:ignore|nocheck)/ },
    { identity: "istanbul", pattern: /istanbul\s+ignore/i },
    { identity: "c8", pattern: /c8\s+ignore/i },
    { identity: "v8", pattern: /v8\s+ignore/i },
    { identity: "sonar", pattern: /\bNOSONAR\b/ },
]

function sourceFiles(root) {
    const files = []
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!ignoredDirectories.has(entry.name)) files.push(...sourceFiles(join(root, entry.name)))
            continue
        }
        if (entry.isFile() && governedExtensions.has(extname(entry.name))) files.push(join(root, entry.name))
    }
    return files
}

export function scanText(text, path = "source.ts") {
    const findings = []
    const lines = text.replace(/\r\n?/g, "\n").split("\n")
    for (let index = 0; index < lines.length; index += 1) {
        for (const refusal of refusals) {
            if (refusal.pattern.test(lines[index])) findings.push({
                path,
                line: index + 1,
                identity: refusal.identity,
                evidence: lines[index].trim(),
            })
        }
    }
    return findings
}

export function scanRepository(root) {
    const absolute = resolve(root)
    if (!existsSync(absolute)) return { ok: false, findings: [], error: `repository does not exist: ${absolute}` }
    const findings = sourceFiles(absolute).flatMap((path) => scanText(
        readFileSync(path, "utf8"),
        relative(absolute, path).replaceAll("\\", "/"),
    ))
    return { ok: findings.length === 0, findings, error: null }
}

function main(argv) {
    if (argv.length !== 1) {
        console.error("Usage: node runtime/machines/suppression/check.mjs <repository-root>")
        return 2
    }
    const result = scanRepository(argv[0])
    if (result.error) {
        console.error(result.error)
        return 2
    }
    if (result.findings.length) {
        console.error(`suppression refusal: ${result.findings.length} finding(s)`)
        for (const finding of result.findings) {
            console.error(`- ${finding.path}:${finding.line} [${finding.identity}] ${finding.evidence}`)
        }
        return 1
    }
    console.log("suppression refusal: clean")
    return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2))
}
