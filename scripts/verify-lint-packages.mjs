#!/usr/bin/env node
/**
 * scripts/verify-lint-packages.mjs -- prove the two lint packages are publishable and complete.
 *
 *   node <trust-root>/scripts/verify-lint-packages.mjs
 *
 * WHY THE MANIFEST LIVES INSIDE `sources/<axis>/` AND NOT IN A `packages/` FOLDER.
 *
 * The obvious layout is a package directory that copies the rules in at build time. That is the
 * hand-copy failure wearing a build step: the moment a copy exists, there is a window in which the
 * copy and the law disagree, and every mechanism for closing that window is a mechanism somebody has
 * to remember to run. Putting the manifest in the law's own directory removes the window instead of
 * policing it - the published tarball IS the authored source, so drift is not detected, it is
 * unrepresentable.
 *
 * WHAT THIS SCRIPT EXISTS TO CATCH. A package that resolves on the author's disk and fails on the
 * consumer's. That happens exactly one way: a file `index.mjs` imports is not in the published set,
 * because `files` in the manifest and the import graph drifted apart. Nothing in `npm publish`
 * checks this, and the failure appears only after install, in somebody else's repository.
 *
 * WHY IT SHELLS OUT TO `npm pack --dry-run`. Re-implementing npm's `files` resolution - the
 * negations, the always-included names, the ignore-file precedence - would be a second opinion about
 * what npm packs, and a second opinion is what this whole design refuses. Asking npm is the only
 * answer that cannot be wrong about npm.
 */

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const AXES = ["fe", "be"]
const failures = []

/*
 * ONE COMMAND STRING, NO ARGUMENT ARRAY.
 *
 * `npm` on Windows is `npm.cmd`, and Node refuses to spawn a `.cmd` without a shell. With a shell,
 * passing a separate argument array is what Node deprecates in DEP0190, because the array is
 * concatenated rather than escaped. A single fixed string sidesteps both: nothing here is
 * interpolated, so there is nothing for a shell to mis-parse, and the only variable - the directory
 * - travels as `cwd` rather than inside the command.
 */
const packedFiles = (packageDir) => {
    const raw = execSync("npm pack --dry-run --json", {
        cwd: packageDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    })
    const report = JSON.parse(raw)
    return new Set((report[0]?.files ?? []).map((entry) => entry.path.replace(/\\/g, "/")))
}

/** Every relative `./x.mjs` and `./x.ts` the entry file reaches, one hop deep and then transitively. */
const importGraph = (packageDir, entry) => {
    const seen = new Set()
    const queue = [entry]
    while (queue.length > 0) {
        const file = queue.shift()
        if (seen.has(file)) continue
        seen.add(file)
        let source
        try {
            source = readFileSync(resolve(packageDir, file), "utf8")
        } catch {
            failures.push(`${packageDir}: ${file} is imported but does not exist on disk`)
            continue
        }
        for (const match of source.matchAll(/from\s+"\.\/([^"]+)"/g)) queue.push(match[1])
    }
    return seen
}

for (const axis of AXES) {
    const packageDir = resolve(trustRoot, "sources", axis)
    const manifest = JSON.parse(readFileSync(resolve(packageDir, "package.json"), "utf8"))
    const label = manifest.name

    const packed = packedFiles(packageDir)
    const reached = importGraph(packageDir, "index.mjs")

    // A file the entry imports but npm would not ship: resolves here, throws on the consumer's disk.
    for (const file of reached) {
        if (!packed.has(file)) failures.push(`${label}: imports ./${file} but it is NOT in the published files`)
    }

    // A test that ships is not merely noise: it drags its fixtures and its assumptions into a
    // dependency tree that never asked for them.
    for (const file of packed) {
        if (/\.test\.[cm]?[jt]s$/.test(file)) failures.push(`${label}: publishes a test file, ${file}`)
    }

    // The plugin must load and answer, because a package that installs and then throws on import is
    // worse than one that fails to install: the failure lands at lint time, in somebody else's build.
    const plugin = await import(pathToFileURL(resolve(packageDir, "index.mjs")).href)
    const ruleNames = Object.keys(plugin.rules ?? {})
    const owners = plugin.ruleOwners ?? {}
    if (ruleNames.length === 0) failures.push(`${label}: the entry publishes no rules at all`)

    // Every published rule must name the law it came from. A rule with no owner cannot be explained
    // when it fires, and an unexplainable failure is the one people disable.
    for (const name of ruleNames) {
        if (!owners[name]) failures.push(`${label}: rule '${name}' declares no owning law`)
    }

    // `recommended` is the canon's own opinion about severity. A rule missing from it ships switched
    // off by default, which is a rule that exists as a document.
    const recommended = plugin.recommended ?? {}
    for (const name of ruleNames) {
        if (!(`starci-${axis}/${name}` in recommended) && !(name in recommended)) {
            failures.push(`${label}: rule '${name}' has no recommended severity`)
        }
    }

    console.log(
        `${label}@${manifest.version}: ${ruleNames.length} rules from ${new Set(Object.values(owners)).size} laws, ${packed.size} files published`,
    )
}

if (failures.length > 0) {
    console.error(failures.map((line) => `- ${line}`).join("\n"))
    process.exitCode = 1
} else {
    console.log("Both lint packages are complete and publishable.")
}
