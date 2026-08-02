#!/usr/bin/env node
/**
 * Story-coverage gate: every canonical storybook COMPONENT
 * (`.storybook/components/<sub>/<Name>/<Name>.tsx` — the main file of its folder)
 * must have a story at the mirror path (`.storybook/stories/<sub>/<Name>/*.stories.tsx`).
 *
 * "Main file of its folder" = basename === folder name, so helpers/sub-parts
 * (`ButtonBase.tsx` under `Button/`, `surface-card-header.tsx`, `_slot.ts`) are NOT
 * required to have their own story — they're documented through their owner's story.
 *
 *   node scripts/check-story-coverage.mjs         -> report (exit 1 if gaps)
 *   node scripts/check-story-coverage.mjs --json   -> machine-readable missing list
 */
import { readdirSync, existsSync, statSync } from "node:fs"
import { join, relative, basename, dirname } from "node:path"

const ROOT = process.cwd()
const COMPONENTS = join(ROOT, ".storybook/components")
const STORIES = join(ROOT, ".storybook/stories")

// Component folders that intentionally have no story (internal/behavior primitives,
// namespaces whose members are storied separately). Kept explicit so the gate is honest.
const ALLOWLIST = new Set([
    "frames/Flex", "frames/Box",
])

function walk(dir, out = []) {
    if (!existsSync(dir)) return out
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name)
        if (e.isDirectory()) walk(full, out)
        else if (e.name.endsWith(".tsx") && !e.name.endsWith(".stories.tsx")) out.push(full)
    }
    return out
}

// A "main component file" = basename === its folder name (Button/Button.tsx), not a
// helper sub-file (Button/ButtonBase.tsx) and not a `_`-prefixed registry.
const components = walk(COMPONENTS)
    .filter((f) => {
        const name = basename(f, ".tsx")
        if (name.startsWith("_")) return false
        return name === basename(dirname(f))
    })
    .map((f) => relative(COMPONENTS, dirname(f)).split(/[\\/]/).join("/"))
    .filter((rel) => !ALLOWLIST.has(rel))
    .sort()

const hasStory = (rel) => {
    const dir = join(STORIES, rel)
    return existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(".stories.tsx"))
}

const missing = components.filter((c) => !hasStory(c))

if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(missing))
    process.exit(0)
}

console.log(`Components: ${components.length} | có story: ${components.length - missing.length} | THIẾU: ${missing.length}`)
if (missing.length) {
    console.log("\nComponent thiếu story:")
    for (const m of missing) console.log("  ✗ " + m)
    process.exit(1)
}
console.log("\n✅ Mọi component đều có story.")
