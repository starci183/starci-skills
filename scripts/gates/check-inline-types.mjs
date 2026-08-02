#!/usr/bin/env node
/**
 * TYPE-SHAPE gate (rules/4 §3a). Every data shape must be a NAMED, exported type — an inline
 * `{ a: string; b: number }` has no name to import, so every call-site re-describes it by hand
 * and the two descriptions drift.
 *
 * Checks the THREE positions a shape can hide in, not just props:
 *   prop-inline     `module: { index: number; name: string }`
 *   generic-inline  `Record<AvatarSize, { box: string; dot: string }>`
 *   param-inline    `({ className }: { className?: string })`
 *
 * It distinguishes a TYPE position from a VALUE position by tracking whether it is inside an
 * `interface`/`type` block or inside a `const … = {` block. Without that, the first version
 * counted const-map VALUES (`sm: { box: "size-8" }`) as inline types and reported 154 instead
 * of 73 — the numbers in rules/4 come from the fixed version.
 *
 *   node scripts/check-inline-types.mjs             -> report (exit 1 if any)
 *   node scripts/check-inline-types.mjs --json      -> machine-readable
 *   node scripts/check-inline-types.mjs --impl-only -> skip *.stories.tsx (scope question C12)
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = process.cwd()
const SB = join(ROOT, ".storybook")
const IMPL_ONLY = process.argv.includes("--impl-only")

const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) {
            walk(path, out)
        } else if (/\.tsx?$/.test(entry)) {
            out.push(path)
        }
    }
    return out
}

const findings = []
const files = walk(SB)
    .filter((f) => !f.includes("_legacy"))
    .filter((f) => !IMPL_ONLY || !f.includes(".stories."))

for (const file of files) {
    const rel = relative(ROOT, file).replaceAll("\\", "/")
    const isStory = rel.includes(".stories.")
    const lines = readFileSync(file, "utf8").split("\n")

    /** "type" inside an interface/type body · "value" inside a `const … = {` body · null outside. */
    let context = null
    let depth = 0
    let inBlockComment = false

    lines.forEach((line, index) => {
        const trimmed = line.trim()
        if (trimmed.startsWith("/*") || trimmed.startsWith("{/*")) inBlockComment = true
        const isComment = trimmed.startsWith("//") || inBlockComment || trimmed.startsWith("*")
        if (inBlockComment && trimmed.includes("*/")) inBlockComment = false
        if (isComment) return

        if (context === null) {
            if (/^(export )?(interface \w+|type \w+\s*=)/.test(trimmed)) context = "type"
            else if (/^(export )?(const|let) \w+.*=\s*\{$/.test(trimmed)) context = "value"
        }
        if (context) depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length

        const at = { file: rel, line: index + 1, isStory, code: trimmed.slice(0, 100) }

        // A prop whose type is an inline object — only meaningful in a TYPE context.
        if (context === "type" && /^\w+\??:\s*(\{|(?:Array|ReadonlyArray)<\s*\{)/.test(trimmed)) {
            findings.push({ ...at, rule: "prop-inline" })
        } else if (/(?:Record|Map|Partial|Omit|Pick|ReadonlyArray|Array)<[^<>]*\{\s*\w+\??:/.test(trimmed)) {
            findings.push({ ...at, rule: "generic-inline" })
        } else if (/\}\s*:\s*\{\s*\w+\??:/.test(trimmed) || /\(\s*\w+\s*:\s*\{\s*\w+\??:/.test(trimmed)) {
            findings.push({ ...at, rule: "param-inline" })
        }

        if (context && depth <= 0) {
            context = null
            depth = 0
        }
    })
}

if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(findings))
    process.exit(0)
}

const LABEL = {
    "prop-inline": "PROP có type object inline — bóc ra interface (`XLike`/`XItem`)",
    "generic-inline": "GENERIC mang type object inline — đặt tên (`XStyle`/`XConfig`)",
    "param-inline": "THAM SỐ HÀM có type object inline — đặt tên (`XProps`)",
}

const byRule = {}
for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1
const inImpl = findings.filter((f) => !f.isStory).length

console.log(
    `File quét: ${files.length} | hình dữ liệu KHÔNG CÓ TÊN: ${findings.length}` +
        (IMPL_ONLY ? " (chỉ impl)" : ` (impl ${inImpl} · story ${findings.length - inImpl})`),
)
for (const [rule, count] of Object.entries(byRule)) console.log(`  ${String(count).padStart(3)}  ${LABEL[rule]}`)

for (const rule of Object.keys(LABEL)) {
    const rows = findings.filter((f) => f.rule === rule)
    if (!rows.length) continue
    console.log(`\n── ${LABEL[rule]}`)
    for (const f of rows) console.log(`  ${f.file}:${f.line}${f.isStory ? "  [story]" : ""}\n        ${f.code}`)
}

if (findings.length) {
    console.log(
        "\nGHI CHÚ: `type XProps = A & B` (hợp thành, để union loại trừ nhau) là HỢP LỆ và KHÔNG bị" +
            " báo ở đây — gate chỉ bắt hình KHÔNG CÓ TÊN. Phạm vi story vs impl: xem C12/C13.",
    )
    process.exit(1)
}
console.log("\n✅ Mọi hình dữ liệu đều có tên.")
