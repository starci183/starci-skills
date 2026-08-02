#!/usr/bin/env node
/**
 * P2 gate — a `src/` file must NOT import the storybook tree.
 *
 * `@sb-components/*` resolves to `.storybook/components/*` (dev-only design catalog).
 * Production `src/` code imports the SRC TWIN (`@/components/*`) instead, so the app
 * never depends on `.storybook/`. Every design-system component has a twin under
 * `src/components/**`; if one is missing, create the twin (mirror the storybook file
 * with `@sb-components/` rewritten to `@/components/`, collapsing `/X/X` → `/X`).
 *
 *   node scripts/check-src-sb-import.mjs   # gate (exit 1 on any @sb import in src)
 */
import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const SRC = path.join(ROOT, "src")

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full, out)
        else if (/\.(tsx?|ts)$/.test(e.name)) out.push(full)
    }
    return out
}

const violations = []
for (const file of walk(SRC)) {
    const src = fs.readFileSync(file, "utf8")
    src.split("\n").forEach((line, i) => {
        if (/from\s+["']@sb-(components|utils)\//.test(line) || /import\(["']@sb-(components|utils)\//.test(line)) {
            violations.push({ rel: path.relative(ROOT, file), line: i + 1, text: line.trim().slice(0, 100) })
        }
    })
}

if (violations.length === 0) {
    console.log("check-src-sb-import: OK — no src file imports the storybook tree.")
    process.exit(0)
}

console.log(`check-src-sb-import: ${violations.length} src file(s) import @sb-* (should use the @/components twin)\n`)
for (const v of violations.slice(0, 80)) console.log(`  ${v.rel}:${v.line}  ${v.text}`)
if (violations.length > 80) console.log(`  … +${violations.length - 80} more`)
console.log(`\nFix: import the src twin (@/components/...) or create it if missing.`)
process.exit(1)
