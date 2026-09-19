/*
 * Peer links for standalone kit checks.
 *
 * The kit ships as SOURCE consumed through each app's `@fe-kit/*` path alias, so its
 * peer imports (react, next-intl, @starci/grammar) must resolve to the CONSUMER's own
 * installed copies - a second real react next to the app's would split the hook
 * dispatcher and the theme context would silently stop working. Node/webpack/tsc all
 * resolve bare imports by walking node_modules upward from the real file path, and no
 * consumer's node_modules sits above .claude/packages/fe-kit - so this script junctions
 * the needed packages into ./node_modules, pointing at one consumer's installed tree.
 * In a consumer build the bundler's own resolve.alias additionally pins these names to
 * that consumer's copies, so the junctions are what eslint/tsc/vitest see and never the
 * copy an app bundle actually links.
 *
 * Usage: node scripts/link-peers.mjs [consumer]
 *   consumer defaults to "todo-app-frontend" (any example app root under ../examples).
 */
import { existsSync, mkdirSync, symlinkSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const consumer = process.argv[2] ?? "todo-app-frontend"
const consumerNodeModules = resolve(KIT_ROOT, "..", "..", "examples", consumer, "node_modules")

const PEERS = [
    "react",
    "react-dom",
    "next",
    "next-intl",
    "@starci/grammar",
    "@types/react",
    "@types/react-dom",
]

const linked = []
const missing = []
for (const name of PEERS) {
    const target = resolve(consumerNodeModules, name)
    const link = resolve(KIT_ROOT, "node_modules", name)
    if (!existsSync(target)) {
        missing.push(name)
        continue
    }
    if (existsSync(link)) continue
    mkdirSync(dirname(link), { recursive: true })
    // Junctions need no elevation on Windows and follow directory moves like symlinks.
    symlinkSync(target, link, "junction")
    linked.push(name)
}

if (missing.length > 0) {
    console.error(`missing in ${consumerNodeModules}: ${missing.join(", ")}`)
    process.exitCode = 1
} else {
    console.log(`fe-kit peers linked from ${consumer}: ${linked.length ? linked.join(", ") : "already linked"}`)
}
