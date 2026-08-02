#!/usr/bin/env node
/**
 * GATE — no component namespaces. A component is reached by its own NAME, never through a
 * dot on another component.
 *
 * WHY. `Button.Base` reads like a variant of `Button` and is not: the members of a namespace
 * here almost never shared a prop signature, so the dot promised a family and delivered a
 * folder. It also made the anatomy panel ambiguous — `Avatar.Base` (ours) and `Avatar`
 * (HeroUI's) were two different nodes whose names differed only by a suffix.
 *
 * WHAT IT CATCHES. The three shapes the flattening pass had to handle, and which a future
 * component would reintroduce without noticing:
 *
 *   A) export const X = Object.assign(XBase, { Base, Group })
 *   B) export const X = { Base, List }
 *   C) export const X = Object.assign((props) => <Y …/>, { Prominent, Inline })
 *
 * ⚠️ FILES ARE CRLF. A regex written against `\n` matches NOTHING here and the gate goes
 * quietly green — that exact mistake made an inventory report 66 namespaces when there were
 * 111 members. Everything below works off LINES.
 *
 * `_legacy` is checked too: it consumes the same modules, so a namespace there is a namespace
 * in the system.
 *
 *   node scripts/check-no-namespace.mjs            -> report, exit 1 if any found
 *   node scripts/check-no-namespace.mjs --control   -> negative control (must report 1)
 *
 * ⚠️ `ContentPage`'s mobile/tablet-only nudge (thầy 2026-07-28) was briefly built as a
 * `ContentPage.Mobile`/`.Tablet` namespace, allowlisted here — then corrected the SAME day
 * to a CSS-only fix (`@app-lg:hidden` on the one extra node, one render tree, no namespace at
 * all). No exception needed. If a future case genuinely needs one, name it explicitly here
 * with the date and reasoning — do not silently reintroduce the allowlist pattern.
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(process.argv[2] ?? ".storybook")
const CONTROL = process.argv.includes("--control")

const walk = (d, out = []) => {
    if (!fs.existsSync(d)) return out
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) {
            if (e.name !== "node_modules") walk(p, out)
        } else if (e.name.endsWith(".tsx") && !e.name.endsWith(".stories.tsx")) out.push(p)
    }
    return out
}
const rel = (f) => path.relative(process.cwd(), f).split(path.sep).join("/")

/** A member line inside the object: `Base,` or `Accordion: AccordionCard,` (comma optional). */
const MEMBER = /^ {4,8}([A-Z][A-Za-z0-9]*)\s*(?::\s*[A-Za-z0-9_]+)?\s*,?\s*$/

const scan = (lines) => {
    const found = []
    for (let i = 0; i < lines.length; i++) {
        const open =
            lines[i].match(/^export const ([A-Z][A-Za-z0-9]*) = Object\.assign\(.*$/) ??
            lines[i].match(/^export const ([A-Z][A-Za-z0-9]*) = \{$/)
        if (!open) continue
        const members = []
        for (let j = i + 1; j < lines.length; j++) {
            if (/^[)}]/.test(lines[j])) break
            const m = lines[j].match(MEMBER)
            if (m) members.push(m[1])
        }
        if (members.length) found.push({ ns: open[1], members, line: i + 1 })
    }
    return found
}

const rows = []
for (const file of walk(path.join(ROOT, "components"))) {
    for (const hit of scan(fs.readFileSync(file, "utf8").split(/\r?\n/))) rows.push({ file: rel(file), ...hit })
}

if (CONTROL) {
    // Prove the scanner can see a namespace at all before trusting a zero from it.
    const fake = [
        "export const Widget = Object.assign(WidgetBase, {",
        "    Base: WidgetBase,",
        "    Group: WidgetGroup,",
        "})",
    ]
    const got = scan(fake)
    console.log(
        got.length === 1 && got[0].members.length === 2
            ? "✓ negative control: bắt được namespace giả (Widget: Base, Group)"
            : `✗ negative control HỎNG — quét mẫu giả ra ${JSON.stringify(got)}`,
    )
    process.exit(got.length === 1 ? 0 : 2)
}

console.log(`namespace còn lại: ${rows.length}`)
for (const r of rows) console.log(`  ${r.file}:${r.line}  ${r.ns} → ${r.members.join(" ")}`)
if (rows.length) {
    console.log("\nMột component được gọi bằng TÊN của nó. Tách ra thành các export ngang hàng:")
    console.log("  `X.Base` → `X`  ·  `X.Member` → `XMember`")
    process.exit(1)
}
console.log("✅ Không còn namespace nào — mọi component đứng bằng tên riêng.")
