#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { extname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const machineRoot = resolve(fileURLToPath(new URL(".", import.meta.url)))

/**
 * Names of trees that are being retired. These are path components rather than
 * loose words: `.mounting` and `some-.mount` are not references to `.mount`.
 */
export const LEGACY_ROOTS = [
    ".claude_legacy",
    ".claude-v3",
    ".claude-starci-ultimate",
    ".mount",
    ".containers",
]

const legacyPattern = new RegExp(
    `(?<![A-Za-z0-9._-])(${LEGACY_ROOTS.map(escapeRegExp).join("|")})(?![A-Za-z0-9._-])`,
    "g",
)

// These are generated or disposable trees, not active source. The retired
// trees themselves are also skipped: references inside a target being retired
// cannot keep that target alive.
const defaultIgnoredDirectories = new Set([
    ".git",
    ".gitmounts",
    ".next",
    ".repo",
    ".scannerwork",
    ".secrets",
    ".stacks",
    ".turbo",
    ".worktrees",
    ".volume",
    "build",
    "coverage",
    "dist",
    "generated",
    "node_modules",
    "out",
])

const generatedDirectorySequences = [
    [".claude", "docs"],
    ["docs", ".next"],
    ["docs", "out"],
    ["docs", "dist"],
    ["docs", "build"],
    ["docs", "generated"],
]

const binaryExtensions = new Set([
    ".7z", ".avi", ".bmp", ".class", ".dll", ".doc", ".docx", ".gif", ".ico", ".jar",
    ".jpeg", ".jpg", ".mov", ".mp3", ".mp4", ".otf", ".pdf", ".png", ".so", ".tar",
    ".ttf", ".wasm", ".webp", ".woff", ".woff2", ".xls", ".xlsx", ".zip",
])

const maxEvidenceLength = 500

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function posixPath(value) {
    return value.split(sep).join("/")
}

function normalizedLines(text) {
    return text.replace(/\r\n?/g, "\n").split("\n")
}

function evidenceFor(line) {
    const trimmed = line.trim()
    return trimmed.length > maxEvidenceLength ? `${trimmed.slice(0, maxEvidenceLength)}…` : trimmed
}

function isWithin(path, root) {
    const candidate = resolve(path)
    const parent = resolve(root)
    return candidate === parent || candidate.startsWith(`${parent}${sep}`)
}

function isGeneratedDirectory(segments) {
    return generatedDirectorySequences.some((sequence) =>
        sequence.every((segment, index) => segments[index] === segment)
        || sequence.every((segment, index) => segments.slice(-sequence.length)[index] === segment),
    )
}

function shouldSkipDirectory(segments, entryName, options) {
    if (defaultIgnoredDirectories.has(entryName)) return true
    if (LEGACY_ROOTS.includes(entryName)) return true
    if (entryName === "retirement" && segments.at(-1) === "machines" && segments.at(-2) === ".claude") return true
    if (isGeneratedDirectory(segments.concat(entryName))) return true
    return (options.ignoredDirectories ?? []).includes(entryName)
}

function shouldSkipFile(path, relativePath, options) {
    const normalized = posixPath(relativePath)
    if (isWithin(path, machineRoot)) return true
    if ((options.ignoredPaths ?? []).some((candidate) => normalized === candidate || normalized.startsWith(`${candidate}/`))) return true
    if (binaryExtensions.has(extname(path).toLowerCase())) return true
    return false
}

function walkFiles(root, options = {}, current = root, segments = []) {
    const files = []
    const entries = readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
        const path = join(current, entry.name)
        const nextSegments = segments.concat(entry.name)
        if (entry.isDirectory()) {
            if (!shouldSkipDirectory(segments, entry.name, options)) files.push(...walkFiles(root, options, path, nextSegments))
            continue
        }
        if (!entry.isFile()) continue
        const relativePath = posixPath(relative(root, path))
        if (!shouldSkipFile(path, relativePath, options)) files.push(path)
    }
    return files
}

/** Find every exact legacy path component in one text file. */
export function scanText(text, path = "source", options = {}) {
    if (text.includes("\u0000")) return []
    const findings = []
    for (const [lineIndex, line] of normalizedLines(text).entries()) {
        legacyPattern.lastIndex = 0
        for (const match of line.matchAll(legacyPattern)) {
            if (options.ignoreFixtureStrings && options.fixturePattern?.test(line)) continue
            findings.push({
                path,
                line: lineIndex + 1,
                column: match.index + 1,
                legacyRoot: match[1],
                evidence: evidenceFor(line),
            })
        }
    }
    return findings
}

/**
 * Scan a repository without following symlinks or depending on filesystem
 * enumeration order. Findings are sorted by path, line, column and root.
 */
export function scanRepository(root, options = {}) {
    const absolute = resolve(root)
    if (!existsSync(absolute)) return { ok: false, root: absolute, filesScanned: 0, findings: [], error: `repository does not exist: ${absolute}` }

    let files
    try {
        files = walkFiles(absolute, options)
    } catch (error) {
        return { ok: false, root: absolute, filesScanned: 0, findings: [], error: `cannot scan repository: ${error.message}` }
    }

    const findings = files.flatMap((path) => {
        let text
        try {
            text = readFileSync(path, "utf8")
        } catch {
            return []
        }
        return scanText(text, posixPath(relative(absolute, path)))
    }).sort((left, right) =>
        left.path.localeCompare(right.path)
        || left.line - right.line
        || left.column - right.column
        || left.legacyRoot.localeCompare(right.legacyRoot),
    )

    return { ok: findings.length === 0, root: absolute, filesScanned: files.length, findings, error: null }
}

export function formatReport(result) {
    if (result.error) return `legacy retirement: error\n- ${result.error}`
    if (!result.findings.length) return `legacy retirement: clean (${result.filesScanned} file(s) scanned)`
    const lines = [`legacy retirement: ${result.findings.length} active reference(s)`]
    for (const finding of result.findings) {
        lines.push(`- ${finding.path}:${finding.line}:${finding.column} [${finding.legacyRoot}] ${finding.evidence}`)
    }
    return lines.join("\n")
}

function parseArgs(argv) {
    const options = { strict: false, json: false }
    const roots = []
    for (const argument of argv) {
        if (argument === "--strict") options.strict = true
        else if (argument === "--json") options.json = true
        else if (argument === "--report") continue
        else roots.push(argument)
    }
    if (roots.length > 1) return null
    return { ...options, root: roots[0] ?? resolve(machineRoot, "../../..") }
}

export function main(argv) {
    const parsed = parseArgs(argv)
    if (!parsed) {
        console.error("Usage: node .claude/machines/retirement/check.mjs [--report|--strict] [--json] [repository-root]")
        return 2
    }
    const result = scanRepository(parsed.root)
    console.log(parsed.json ? JSON.stringify(result, null, 2) : formatReport(result))
    if (result.error) return 2
    return parsed.strict && !result.ok ? 1 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2))
}
