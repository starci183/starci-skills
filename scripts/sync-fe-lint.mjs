#!/usr/bin/env node
/**
 * scripts/sync-fe-lint.mjs -- one authored rule set, mirrored into each front end and checked.
 *
 *   node <trust-root>/scripts/sync-fe-lint.mjs --target <repo>            report drift only
 *   node <trust-root>/scripts/sync-fe-lint.mjs --target <repo> --write    write the mirror
 *
 * WHY A MIRROR AND NOT AN IMPORT. The obvious "single source" is to have the repository import
 * `.claude/sources/fe/index.mjs` directly. It cannot: that path climbs out of the repository root,
 * so it resolves only while both checkouts sit side by side. Clone the front end alone, run a CI job
 * that fetches one repository, build a Docker image that copies one directory - the config does not
 * load at all. A rule set that disappears when the neighbour is missing is not a single source, it
 * is a dependency nobody declared.
 *
 * WHY GENERATED AND NOT COPIED BY HAND. Copied-by-hand is what this replaced, and the cost was not
 * staleness. Four copies drifted in rule NAMES, so a repository passed its own gate while failing
 * canon's; and one copy knew only the single-app folder layout, so aimed at a monorepo it reported
 * fifty correct files as broken - which read as fifty owed fixes and was none. A mirror this script
 * writes and re-hashes cannot drift silently: running it again is the check.
 *
 * WHAT IS ALLOWED TO DIFFER. The config, never the rules. A monorepo lints its shared package and
 * each app's source tree; a single app lints one source tree. Which globs the law applies to is a
 * repository's own fact. What the law SAYS is not.
 *
 * IT NEVER EDITS PRODUCT SOURCE. It writes the mirror and one import line. Everything the complete
 * rule set then reports is somebody's decision, and this script refuses to blur the two.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const TRUST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CANON_DIR = resolve(TRUST_ROOT, "sources/fe")
/** Where the mirror lands inside a consuming repository. */
const MIRROR_RELATIVE = "plugins/eslint-canon"

const ESC = String.fromCharCode(27)
const paint = (code, text) => (process.stdout.isTTY ? `${ESC}[${code}m${text}${ESC}[0m` : text)
const green = (text) => paint("32", text)
const yellow = (text) => paint("33", text)
const red = (text) => paint("31", text)
const dim = (text) => paint("2", text)

/** Aborts with a readable message rather than a stack trace. */
const die = (message, hints = []) => {
    console.error(`\n${red("sync-fe-lint:")} ${message}`)
    for (const hint of hints) console.error(`  ${hint}`)
    console.error("")
    process.exit(1)
}

/**
 * A content hash of one directory: every file's path and bytes, in a stable order.
 *
 * Path AND bytes, because a mirror missing a file is as wrong as a mirror whose file was edited,
 * and a hash over contents alone cannot tell the difference.
 *
 * @param dir - absolute directory path.
 * @returns hex digest, or null when the directory is absent.
 */
const digestOf = (dir) => {
    if (!existsSync(dir)) return null
    const hash = createHash("sha256")
    const walk = (current, prefix) => {
        for (const name of readdirSync(current).sort()) {
            const path = join(current, name)
            const rel = prefix ? `${prefix}/${name}` : name
            if (statSync(path).isDirectory()) walk(path, rel)
            else hash.update(rel).update(readFileSync(path))
        }
    }
    walk(dir, "")
    return hash.digest("hex")
}

const MARKER_BEGIN = "// >>> sync-fe-lint.mjs -- canon rule wiring, do not edit by hand >>>"
const MARKER_END = "// <<< sync-fe-lint.mjs -- canon rule wiring <<<"

/** The import block written into a repository's eslint config. */
const wiringBlock = `${MARKER_BEGIN}
/*
 * The rules are authored in the trust tree and MIRRORED here by sync-fe-lint.mjs. Do not edit
 * anything under plugins/eslint-canon/ and do not add a rule to it: the next run overwrites the
 * folder, and a rule that exists only here is a second answer to a question canon already answers.
 *
 * What this repository does own is the config below - which globs the rules apply to.
 */
import starciFe, {
    recommended as starciRecommended,
    linterOptions as starciLinterOptions,
    starciFeConfig,
} from "./${MIRROR_RELATIVE}/index.mjs"
${MARKER_END}`

/**
 * What is not yet true about a repository's wiring.
 *
 * @param repoRoot - absolute path of the target repository.
 * @returns findings and the resolved paths the caller needs.
 */
const inspect = (repoRoot) => {
    const findings = []
    const configPath = resolve(repoRoot, "eslint.config.mjs")
    const mirrorPath = resolve(repoRoot, MIRROR_RELATIVE)
    if (!existsSync(configPath)) {
        findings.push("no eslint.config.mjs -- nothing enforces canon here at all")
        return { findings, configPath, mirrorPath }
    }
    const config = readFileSync(configPath, "utf8")
    if (existsSync(resolve(repoRoot, "plugins/eslint"))) {
        findings.push("plugins/eslint/ exists -- a hand-maintained rule set that can and did drift")
    }
    if (existsSync(resolve(repoRoot, ".claude/sources/fe"))) {
        findings.push(".claude/sources/fe/ exists -- a second mirror in a second place")
    }
    const mirrored = digestOf(mirrorPath)
    if (mirrored === null) findings.push(`${MIRROR_RELATIVE}/ is missing`)
    else if (mirrored !== digestOf(CANON_DIR)) findings.push(`${MIRROR_RELATIVE}/ has drifted from the trust tree`)
    if (!config.includes(MARKER_BEGIN)) findings.push("eslint.config.mjs does not import the mirror")
    return { findings, configPath, mirrorPath }
}

const argv = process.argv.slice(2)
if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`
sync-fe-lint -- one authored rule set, mirrored and checked.

  --target <repo>   the front-end repository to inspect
  --write           write the mirror and the import line
`)
    process.exit(0)
}

const targetIndex = argv.indexOf("--target")
const target = targetIndex === -1 ? null : argv[targetIndex + 1]
if (!target) die("--target <repo> is required")
const repoRoot = resolve(target)
if (!existsSync(repoRoot)) die(`target does not exist: ${repoRoot}`)
if (!existsSync(CANON_DIR)) die(`canon rules missing: ${CANON_DIR}`)

const write = argv.includes("--write")
const { findings, configPath, mirrorPath } = inspect(repoRoot)

console.log(`\n${dim("authored in")}  ${relative(process.cwd(), CANON_DIR).replace(/\\/g, "/")}`)
console.log(`${dim("mirrored to")}  ${relative(process.cwd(), mirrorPath).replace(/\\/g, "/")}`)

/*
 * A PRESENT MARKER IS NOT A CORRECT BLOCK, and treating it as one made this script unable to repair
 * its own output: the fence was found, `inspect` reported nothing to do, and a stale import - one
 * written before the canon gained an export - survived every re-run while the command said "ok".
 * With `--write` the block is rewritten unconditionally, so the fence always carries today's shape.
 */
if (findings.length === 0 && !write) {
    console.log(`\n${green("ok")}  mirror matches the trust tree and the config imports it\n`)
    process.exit(0)
}

console.log(`\n${yellow("drift")}  ${findings.length} finding(s):`)
for (const finding of findings) console.log(`    ${finding}`)

if (!write) {
    console.log(dim("\n    re-run with --write to fix it\n"))
    process.exit(1)
}

if (!existsSync(configPath)) die("cannot wire a repository with no eslint.config.mjs")

rmSync(mirrorPath, { recursive: true, force: true })
mkdirSync(dirname(mirrorPath), { recursive: true })
cpSync(CANON_DIR, mirrorPath, { recursive: true })
console.log(dim(`    wrote ${MIRROR_RELATIVE}/`))

for (const stale of ["plugins/eslint", ".claude/sources/fe"]) {
    const path = resolve(repoRoot, stale)
    if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true })
        console.log(dim(`    removed ${stale}`))
    }
}

let config = readFileSync(configPath, "utf8")
if (config.charCodeAt(0) === 0xFEFF) config = config.slice(1)
const fence = new RegExp(
    `${MARKER_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
)
config = config.replace(fence, "")
config = config.replace(/^import starciFe from "\.\/plugins\/eslint\/index\.mjs"\n/m, "")
writeFileSync(configPath, `${wiringBlock}\n${config}`)

console.log(`\n${green("ok")}  mirror written and imported`)
console.log(dim("    run this again any time: a changed trust tree shows up here as drift\n"))
