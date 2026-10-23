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
 * that consumer's copies, so the junctions are what eslint/tsc see and never the
 * copy an app bundle actually links.
 *
 * The lint and type checks of this kit and of the harness UI (ui/) run the front-end lint canon from this repository's own source
 * (packages/eslint/fe), which resolves its plugins (typescript-eslint, sonarjs, unicorn, react-hooks) from its own location; the
 * consumer's node_modules, which installed exactly those for its own lint, is junctioned there as well.
 *
 * Usage: node packages/fe-kit/scripts/link-peers.mjs [consumer]
 *   consumer defaults to the declared reference example app (any example app root under the runtime's
 *   examples tree; the app root holds the one install).
 */
import { existsSync, mkdirSync, symlinkSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { EXAMPLES_ROOT, REFERENCE_EXAMPLE_APP } from "../../../scripts/lib/example-refs.mjs"

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const consumer = process.argv[2] ?? REFERENCE_EXAMPLE_APP
const consumerNodeModules = resolve(KIT_ROOT, "..", "..", EXAMPLES_ROOT, consumer, "node_modules")

const PEERS = [
    "react",
    "react-dom",
    "next",
    "next-intl",
    "@starci/grammar",
    "@types/react",
    "@types/react-dom",
    "eslint",
    "typescript",
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

const canonModules = resolve(KIT_ROOT, "..", "eslint", "fe", "node_modules")
if (!existsSync(canonModules) && existsSync(consumerNodeModules)) {
    symlinkSync(consumerNodeModules, canonModules, "junction")
    linked.push("the lint canon's node_modules")
}

if (missing.length > 0) {
    console.error(`missing in ${consumerNodeModules}: ${missing.join(", ")}`)
    process.exitCode = 1
} else {
    console.log(`fe-kit peers linked from ${consumer}: ${linked.length ? linked.join(", ") : "already linked"}`)
}
