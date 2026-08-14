#!/usr/bin/env node
/**
 * scripts/sync-be-lint.mjs -- one authored rule set, mirrored into each back end and checked.
 *
 *   node <trust-root>/scripts/sync-be-lint.mjs --target <repo>            report drift only
 *   node <trust-root>/scripts/sync-be-lint.mjs --target <repo> --write    write the mirror
 *   node <trust-root>/scripts/sync-be-lint.mjs --target <repo> --write --retire-local-plugin
 *
 * WHY A MIRROR AND NOT AN IMPORT. The obvious "single source" is to have the repository import
 * `.claude/sources/be/index.mjs` directly. It cannot, and on this axis the reason is sharper than the
 * front end's: `.claude/` is GITIGNORED by the back end, because the trust tree is its own
 * repository. A config importing it resolves on the machine that wrote it and nowhere else - not in
 * a fresh clone, not in CI, not in a Docker build. A rule set that disappears when the neighbour is
 * missing is not a single source; it is an undeclared dependency.
 *
 * WHY GENERATED AND NOT COPIED BY HAND. Copied-by-hand is what this replaces, and the cost here was
 * not staleness but NAMES: the back end's own plugin calls one law `no-nest-logger` while canon calls
 * it `no-framework-logger`, so the repository passed its gate while failing canon's and no build log
 * could say which rule had spoken. A mirror this script writes and re-hashes cannot drift silently -
 * running it again is the check.
 *
 * WHY IT REFUSES TO DELETE THE LOCAL PLUGIN BY DEFAULT. The front-end script removes `plugins/eslint`
 * as part of wiring, and that removal cost seven live rules which are still owed back - an adoption
 * that quietly SUBTRACTS enforcement, wearing the word adoption. So this one measures first: every
 * rule name the local plugin publishes that canon does not is printed, and the folder is removed only
 * when that set is empty AND `--retire-local-plugin` says so out loud.
 *
 * WHAT IS ALLOWED TO DIFFER. The config, never the rules. Which globs the law applies to, and which
 * rules a repository has switched on today, are the repository's own facts. What the law SAYS is not.
 *
 * IT NEVER EDITS PRODUCT SOURCE. It writes the mirror and one import block. Everything the complete
 * rule set then reports is somebody's decision, and this script refuses to blur the two.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const TRUST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CANON_DIR = resolve(TRUST_ROOT, "sources/be")
/** Where the mirror lands inside a consuming repository. */
const MIRROR_RELATIVE = "plugins/eslint-canon"
/** The hand-written plugin this mirror is meant to replace, once canon publishes everything it does. */
const LOCAL_PLUGIN_RELATIVE = "plugins/eslint"

const ESC = String.fromCharCode(27)
const paint = (code, text) => (process.stdout.isTTY ? `${ESC}[${code}m${text}${ESC}[0m` : text)
const green = (text) => paint("32", text)
const yellow = (text) => paint("33", text)
const red = (text) => paint("31", text)
const dim = (text) => paint("2", text)

/** Aborts with a readable message rather than a stack trace. */
const die = (message, hints = []) => {
    console.error(`\n${red("sync-be-lint:")} ${message}`)
    for (const hint of hints) console.error(`  ${hint}`)
    console.error("")
    process.exit(1)
}

/**
 * A content hash of one directory: every file's path and bytes, in a stable order.
 *
 * Path AND bytes, because a mirror missing a file is as wrong as a mirror whose file was edited, and
 * a hash over contents alone cannot tell the difference.
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

/**
 * Every rule name the hand-written plugin publishes, read from its source rather than imported.
 *
 * Imported would be cleaner and is not available: the local plugin resolves the target's own
 * dependencies, so loading it from here fails on a machine where the target is not installed.
 *
 * The scan deliberately OVER-collects - any hyphenated string key in the folder counts. An extra name
 * makes this script refuse a deletion it could have allowed, which costs a conversation; a missed one
 * makes it delete a live rule, which costs enforcement nobody notices is gone.
 *
 * @param pluginDir - absolute path of the local plugin folder.
 * @returns the set of candidate rule names.
 */
const localRuleNames = (pluginDir) => {
    const names = new Set()
    if (!existsSync(pluginDir)) return names
    const walk = (current) => {
        for (const entry of readdirSync(current)) {
            const path = join(current, entry)
            if (statSync(path).isDirectory()) {
                walk(path)
                continue
            }
            if (!entry.endsWith(".mjs") || entry.endsWith(".test.mjs")) continue
            const text = readFileSync(path, "utf8")
            for (const hit of text.matchAll(/"([a-z][a-z0-9]*(?:-[a-z0-9]+)+)"\s*:/g)) names.add(hit[1])
        }
    }
    walk(pluginDir)
    return names
}

const MARKER_BEGIN = "// >>> sync-be-lint.mjs -- canon rule wiring, do not edit by hand >>>"
const MARKER_END = "// <<< sync-be-lint.mjs -- canon rule wiring <<<"

/** The import block written into a repository's eslint config. */
const wiringBlock = `${MARKER_BEGIN}
/*
 * The rules are authored in the trust tree and MIRRORED here by sync-be-lint.mjs. Do not edit
 * anything under ${MIRROR_RELATIVE}/ and do not add a rule to it: the next run overwrites the
 * folder, and a rule that exists only here is a second answer to a question canon already answers.
 *
 * What this repository does own is the config below - which globs the rules apply to, and which of
 * them are switched on today. Register the plugin under the name canon publishes:
 *
 *   plugins: { "starci-be": starciBeCanon },
 *   rules: { ...starciBeCanonRecommended, ... },
 */
import starciBeCanon, {
    recommended as starciBeCanonRecommended,
} from "./${MIRROR_RELATIVE}/index.mjs"
${MARKER_END}`

/**
 * What is not yet true about a repository's wiring.
 *
 * @param repoRoot - absolute path of the target repository.
 * @returns findings, the names a deletion would cost, and the resolved paths the caller needs.
 */
const inspect = async (repoRoot) => {
    const findings = []
    const configPath = resolve(repoRoot, "eslint.config.mjs")
    const mirrorPath = resolve(repoRoot, MIRROR_RELATIVE)
    const localPluginPath = resolve(repoRoot, LOCAL_PLUGIN_RELATIVE)
    const canon = await import(pathToFileURL(join(CANON_DIR, "index.mjs")).href)
    const canonNames = new Set(Object.keys(canon.rules))
    const atRisk = [...localRuleNames(localPluginPath)].filter((name) => !canonNames.has(name)).sort()

    if (!existsSync(configPath)) {
        findings.push("no eslint.config.mjs -- nothing enforces canon here at all")
        return { findings, atRisk, canonNames, configPath, mirrorPath, localPluginPath }
    }
    const config = readFileSync(configPath, "utf8")
    const mirrored = digestOf(mirrorPath)
    if (mirrored === null) findings.push(`${MIRROR_RELATIVE}/ is missing`)
    else if (mirrored !== digestOf(CANON_DIR)) findings.push(`${MIRROR_RELATIVE}/ has drifted from the trust tree`)
    if (!config.includes(MARKER_BEGIN)) findings.push("eslint.config.mjs does not import the mirror")
    else if (!/plugins:\s*\{[^}]*starciBeCanon/s.test(config)) {
        findings.push("eslint.config.mjs imports the mirror but registers no plugin from it -- the rules exist and none of them run")
    }
    if (existsSync(localPluginPath)) {
        findings.push(
            atRisk.length === 0
                ? `${LOCAL_PLUGIN_RELATIVE}/ still exists and publishes nothing canon does not -- it can be retired`
                : `${LOCAL_PLUGIN_RELATIVE}/ still publishes ${atRisk.length} name(s) canon does not -- port them before retiring it`,
        )
    }
    /*
     * A MIRRORED RULE NOBODY SWITCHED ON IS THE FAILURE THIS WHOLE MECHANISM EXISTS TO PREVENT,
     * arriving one step later. The config owns the levels, so this is a finding rather than an edit.
     */
    const enabled = new Set([...config.matchAll(/"starci-be\/([a-z0-9-]+)"/g)].map((hit) => hit[1]))
    const dark = [...canonNames].filter((name) => !enabled.has(name)).sort()
    if (dark.length > 0 && config.includes(MARKER_BEGIN)) {
        findings.push(`${dark.length} canon rule(s) are mirrored but named nowhere in the config: ${dark.join(", ")}`)
    }
    return { findings, atRisk, canonNames, configPath, mirrorPath, localPluginPath }
}

const argv = process.argv.slice(2)
if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`
sync-be-lint -- one authored rule set, mirrored and checked.

  --target <repo>           the back-end repository to inspect
  --write                   write the mirror and the import block
  --retire-local-plugin     also remove ${LOCAL_PLUGIN_RELATIVE}/, refused while it publishes a rule canon does not
`)
    process.exit(0)
}

const targetIndex = argv.indexOf("--target")
const target = targetIndex === -1 ? null : argv[targetIndex + 1]
if (!target) die("--target <repo> is required")
const repoRoot = resolve(target)
if (!existsSync(repoRoot)) die(`target does not exist: ${repoRoot}`)
if (!existsSync(join(CANON_DIR, "index.mjs"))) die(`canon rules missing: ${CANON_DIR}/index.mjs`)

const write = argv.includes("--write")
const retire = argv.includes("--retire-local-plugin")
const { findings, atRisk, configPath, mirrorPath, localPluginPath } = await inspect(repoRoot)

console.log(`\n${dim("authored in")}  ${relative(process.cwd(), CANON_DIR).replace(/\\/g, "/")}`)
console.log(`${dim("mirrored to")}  ${relative(process.cwd(), mirrorPath).replace(/\\/g, "/")}`)

/*
 * A PRESENT MARKER IS NOT A CORRECT BLOCK. With `--write` the block is rewritten unconditionally, so
 * the fence always carries today's shape rather than the one that was current when it was written.
 */
if (findings.length === 0 && !write) {
    console.log(`\n${green("ok")}  mirror matches the trust tree and the config imports it\n`)
    process.exit(0)
}

console.log(`\n${yellow("drift")}  ${findings.length} finding(s):`)
for (const finding of findings) console.log(`    ${finding}`)

if (atRisk.length > 0) {
    console.log(`\n${yellow("local-only")}  ${LOCAL_PLUGIN_RELATIVE}/ publishes rules canon does not:`)
    for (const name of atRisk) console.log(`    ${name}`)
    console.log(dim("    each needs a law in be/canon/patterns/ and a module beside it before the folder can go"))
}

if (!write) {
    console.log(dim("\n    re-run with --write to fix the wiring\n"))
    process.exit(1)
}

if (!existsSync(configPath)) die("cannot wire a repository with no eslint.config.mjs")

rmSync(mirrorPath, { recursive: true, force: true })
mkdirSync(dirname(mirrorPath), { recursive: true })
cpSync(CANON_DIR, mirrorPath, { recursive: true })
console.log(dim(`    wrote ${MIRROR_RELATIVE}/`))

if (retire) {
    if (atRisk.length > 0) {
        die(`refusing to remove ${LOCAL_PLUGIN_RELATIVE}/: it still publishes ${atRisk.length} rule(s) canon does not`, [
            "port them into be/canon/patterns/ + sources/be/ first, then re-run",
            "removing it now would subtract enforcement while calling it adoption",
        ])
    }
    if (existsSync(localPluginPath)) {
        rmSync(localPluginPath, { recursive: true, force: true })
        console.log(dim(`    removed ${LOCAL_PLUGIN_RELATIVE}/`))
    }
}

let config = readFileSync(configPath, "utf8")
if (config.charCodeAt(0) === 0xFEFF) config = config.slice(1)
const fence = new RegExp(
    `${MARKER_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
)
config = config.replace(fence, "")
writeFileSync(configPath, `${wiringBlock}\n${config}`)

console.log(`\n${green("ok")}  mirror written and imported`)
console.log(dim("    run this again any time: a changed trust tree shows up here as drift\n"))
