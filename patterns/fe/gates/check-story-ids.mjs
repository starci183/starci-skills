#!/usr/bin/env node
/**
 * storyId gate: every `storyId` declared in an anatomy panel must resolve to a REAL
 * story. A stale id is the worst kind of rot — the Deps link renders fine, points
 * nowhere, and NOTHING fails: not tsc, not eslint, not the build. Only a click.
 *
 *   node scripts/check-story-ids.mjs          -> report (exit 1 if broken outside _legacy)
 *   node scripts/check-story-ids.mjs --json    -> machine-readable broken list
 *   node scripts/check-story-ids.mjs --list    -> dump every known story id
 *
 * Ids come from STORYBOOK'S OWN `toId`/`storyNameFromExport`, not from a local copy of
 * the slug rules. A hand-rolled version matched all 1129 ids the day this was written —
 * which is exactly why it was thrown away: it would keep matching until a Storybook
 * upgrade changed the rules, and then this gate would go quietly wrong instead of red.
 * If the import ever breaks, the script EXITS 2 rather than falling back.
 *
 * `_legacy` is reported as DEBT, not failure: continue.md books 5 broken links there
 * on purpose. Everything else is a hard gate.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { join, relative } from "node:path"

let toId, storyNameFromExport
try {
    ;({ toId, storyNameFromExport } = createRequire(import.meta.url)("storybook/internal/csf"))
} catch (error) {
    console.error(
        "✗ Không nạp được `storybook/internal/csf` — đường dẫn nội bộ này đã đổi sau khi nâng Storybook.\n" +
            "  Sửa import, ĐỪNG tự tính lại luật slug: gate mà tự đoán id thì nó xanh cả khi link đã gãy.\n" +
            `  Chi tiết: ${error.message}`,
    )
    process.exit(2)
}

const ROOT = process.cwd()
const STORIES = join(ROOT, ".storybook/stories")

/**
 * Tên trang autodocs — ĐỌC từ `main.ts`, không hard-code.
 *
 * ⚠️ Bản đầu hard-code `--docs` (mặc định của Storybook) trong khi repo này đặt
 * `docs.defaultName: "Overview"` ⇒ 233 id sai. Số tổng vẫn khớp live index (1362 = 1362)
 * nên đếm-số KHÔNG phát hiện được; chỉ so TẬP mới ra. Dep trỏ `--overview` sẽ bị báo gãy
 * oan, còn `--docs` thì lọt qua — gate sai theo cả hai chiều.
 */
const DOCS_NAME =
    readFileSync(join(ROOT, ".storybook/main.ts"), "utf8").match(/defaultName:\s*"([^"]+)"/)?.[1] ?? "Docs"

/** Every file under a root whose name passes `keep`, recursively. */
const walk = (dir, keep, out = []) => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) {
            walk(path, keep, out)
        } else if (keep(entry)) {
            out.push(path)
        }
    }
    return out
}

/** Where a story id may be DEFINED — only real story files. */
const isStoryFile = (name) => name.endsWith(".stories.tsx")

/**
 * Where a storyId may be DECLARED — any source file, not just stories.
 *
 * ⚠️ The first version of this gate scanned `*.stories.tsx` for declarations too, and
 * reported "✅ clean" while the 11 ids of the whole `CourseContents` screen tree — which
 * live in `components/screens/CourseContents/_shared.tsx` — went unchecked. That is trap
 * #5 in the SKILL's measurement table, and a negative control (inject a fake id, expect
 * red) is what caught it.
 */
const isSourceFile = (name) => /\.(ts|tsx|mdx)$/.test(name)

const files = walk(STORIES, isStoryFile).sort()

/** id -> where it comes from. Also records which titles carry autodocs. */
const known = new Map()
/** Files whose `title` we could not read — the scanner would go blind, so surface them. */
const unreadable = []

for (const file of files) {
    const src = readFileSync(file, "utf8")
    const rel = relative(ROOT, file).replaceAll("\\", "/")
    // Read `title` ONLY inside the `const meta` block, never from the whole file: demo
    // data carries its own `title:` fields (`{ key: "two-sum", title: "Two Sum" }`) and
    // a loose regex happily grabs one. The block also can be a ONE-LINER
    // (`const meta: Meta = { title: "…", tags: […] }`), so no line anchors either —
    // that combination is what left 13 files unread on the first run.
    const metaStart = src.indexOf("const meta")
    const metaEnd = src.indexOf("export default", metaStart)
    const metaBlock = metaStart === -1 ? "" : src.slice(metaStart, metaEnd === -1 ? undefined : metaEnd)
    const title = metaBlock.match(/title:\s*"([^"]+)"/)?.[1]
    if (!title) {
        unreadable.push(rel)
        continue
    }
    // autodocs adds one docs entry per file, named by `docs.defaultName`.
    if (/tags:\s*\[[^\]]*"autodocs"/.test(metaBlock)) {
        known.set(toId(title, DOCS_NAME), rel)
    }
    for (const [, exportName] of src.matchAll(/^export const (\w+)\s*[:=]/gm)) {
        known.set(toId(title, storyNameFromExport(exportName)), rel)
    }
}

if (process.argv.includes("--list")) {
    for (const id of [...known.keys()].sort()) console.log(id)
    process.exit(0)
}

/** Every `storyId: "…"` in the whole design-system tree, with its line. */
const declared = []
for (const file of walk(join(ROOT, ".storybook"), isSourceFile)) {
    const rel = relative(ROOT, file).replaceAll("\\", "/")
    readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
            for (const [, id] of line.matchAll(/storyId:\s*"([^"]+)"/g)) {
                declared.push({ id, file: rel, line: index + 1 })
            }
        })
}

const broken = declared.filter((d) => !known.has(d.id))
const brokenLegacy = broken.filter((d) => d.file.includes("_legacy"))
const brokenLive = broken.filter((d) => !d.file.includes("_legacy"))

if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(brokenLive))
    process.exit(0)
}

console.log(
    `Story: ${files.length} file | id hợp lệ: ${known.size} | storyId khai: ${declared.length} | GÃY: ${broken.length} (live ${brokenLive.length} · _legacy ${brokenLegacy.length})`,
)

if (unreadable.length) {
    console.log(`\n⚠️  Không đọc được \`title\` (scanner mù ở đây): ${unreadable.length}`)
    for (const f of unreadable) console.log("  ? " + f)
}

/** Gợi ý id gần nhất — cùng phần sau `--`, hoặc cùng phần trước. */
const suggest = (id) => {
    const [kind, name] = id.split("--")
    const sameName = [...known.keys()].filter((k) => k.endsWith(`--${name}`))
    if (sameName.length) return sameName.slice(0, 3)
    const sameKind = [...known.keys()].filter((k) => k.startsWith(`${kind}--`))
    return sameKind.slice(0, 3)
}

if (brokenLive.length) {
    console.log("\nstoryId GÃY (link câm — bấm vào không đi đâu):")
    for (const d of brokenLive) {
        console.log(`  ✗ ${d.id}\n      ${d.file}:${d.line}`)
        const near = suggest(d.id)
        if (near.length) console.log(`      → có thật: ${near.join(" · ")}`)
    }
}

if (brokenLegacy.length) {
    console.log(`\nNỢ ĐÃ GHI SỔ — \`_legacy\` (continue.md §3, không chặn): ${brokenLegacy.length}`)
    for (const d of brokenLegacy) console.log(`  · ${d.id} — ${d.file}:${d.line}`)
}

if (brokenLive.length) {
    process.exit(1)
}
console.log("\n✅ Mọi storyId ngoài `_legacy` đều trỏ tới story thật.")
