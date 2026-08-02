#!/usr/bin/env node
/**
 * P1 gate — the shimmer prop is `isSkeleton`, always.
 *
 * A presentational component's "render me as a placeholder" flag must be named
 * `isSkeleton` (the one universal shimmer prop, threaded DOWN to children). The
 * connected file owns WHEN to shimmer — it computes the condition (SWR loading,
 * counts pending…) under any local name and injects it at the top as
 * `isSkeleton={...}`. `isLoading` is reserved for the async-STATE SWITCH input of
 * `AsyncContent` (which selects error/loading/empty/content), never a shimmer prop.
 *
 * The shimmer concept ONLY. NOT flagged: `isPending` (an action in flight → button
 * spinner + press-lock) and `isLoading` (the AsyncContent branch switch) — both are
 * legitimate, distinct concepts a component may also carry.
 *
 * Flags: `isSkeleton={<name>}` where `<name>` is NOT `isSkeleton` and IS a
 * destructured PROP of that component — i.e. the shimmer flag was mis-named (e.g.
 * `isLoading`/`isPending`) instead of being called `isSkeleton` and threaded as-is.
 * (A connected file feeding `isSkeleton={someLocalCondition}` is fine — locals aren't
 * props, so they're not flagged.)
 *
 *   node scripts/check-skeleton-prop.mjs   # gate (exit 1 on any violation)
 */
import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const ROOTS = [".storybook/components", "src/components"]

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full, out)
        else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full)
    }
    return out
}

/** Names destructured in an arrow/function param list `({ a, b = x, c }: T) =>`. */
function destructuredParamNames(src) {
    const names = new Set()
    for (const m of src.matchAll(/\(\s*\{([^}]*)\}\s*:\s*\w+/g)) {
        for (const part of m[1].split(",")) {
            const n = part.trim().split(/[=:]/)[0].trim()
            if (/^\w+$/.test(n)) names.add(n)
        }
    }
    return names
}

const violations = []
for (const root of ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
        const src = fs.readFileSync(file, "utf8")
        const rel = path.relative(ROOT, file)
        const props = destructuredParamNames(src)

        src.split("\n").forEach((line, i) => {
            for (const m of line.matchAll(/isSkeleton=\{(\w+)\}/g)) {
                const name = m[1]
                // Allow scoped skeleton flags — a page with several independent async
                // regions may thread `isSessionSkeleton`/`isResultSkeleton` etc. The
                // violation is feeding a NON-skeleton concept (isLoading/isPending/isBusy).
                if (name !== "isSkeleton" && !/skeleton$/i.test(name) && props.has(name)) {
                    violations.push({ rel, line: i + 1, kind: "shimmer mis-named", text: `isSkeleton={${name}} — the prop feeding it should BE \`isSkeleton\`` })
                }
            }
        })
    }
}

if (violations.length === 0) {
    console.log("check-skeleton-prop: OK — every shimmer prop is `isSkeleton`.")
    process.exit(0)
}

console.log(`check-skeleton-prop: ${violations.length} violation(s)\n`)
for (const v of violations.slice(0, 80)) {
    console.log(`  ${v.rel}:${v.line}  [${v.kind}]  ${v.text}`)
}
if (violations.length > 80) console.log(`  … +${violations.length - 80} more`)
console.log(`\nFix: rename the shimmer prop to \`isSkeleton\` and thread it down; keep \`isLoading\` only for the AsyncContent switch.`)
process.exit(1)
