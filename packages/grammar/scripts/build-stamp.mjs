import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

/**
 * The build stamp ties a built `dist/` to the exact source it was built from.
 *
 * `npm run build` ends by writing `dist/.build-stamp.json`: the package version, the source digest
 * (below), a digest of the built files, and the build time. The root check
 * `scripts/checks/grammar-dist.mjs` recomputes the source digest and refuses a dist whose stamp is
 * missing or names other source, so a stale build can no longer pass for the current one.
 *
 * The source digest covers everything that decides what `dist/` contains: every file under `src/`
 * except stories, test helpers, specs and tests (they never ship), `tsconfig.build.json`,
 * `scripts/copy-css.mjs`, and the `exports` and `files` fields of `package.json`. Line endings are
 * normalised so a CRLF checkout of the same commit has the same digest.
 */

export const STAMP_FILE = ".build-stamp.json"
export const STAMP_SCHEMA = "starci/grammar-build-stamp@1"
export const DIGEST_ALGORITHM = "starci/grammar-source-digest@1"

const DEV_ONLY_DIRS = new Set(["stories", "__test__"])
const DEV_ONLY_FILE = /\.(?:stories|spec|test)\./

const slash = (value) => value.replaceAll("\\", "/")
const normalised = (buffer) => Buffer.from(buffer.toString("latin1").replaceAll("\r\n", "\n"), "latin1")

function filesUnder(dir, keep = () => true) {
    if (!existsSync(dir)) return []
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return keep(entry, true) ? filesUnder(full, keep) : []
        return entry.isFile() && keep(entry, false) ? [full] : []
    })
}

function hashEntries(entries) {
    const hash = createHash("sha256")
    for (const [name, bytes] of entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        hash.update(name)
        hash.update("\0")
        hash.update(bytes === null ? "<absent>" : bytes)
        hash.update("\0")
    }
    return `sha256:${hash.digest("hex")}`
}

/** The files the source digest reads, relative to the package root, in digest order. */
export function sourceInputs(packageRoot) {
    const src = filesUnder(join(packageRoot, "src"), (entry, isDir) =>
        isDir ? !DEV_ONLY_DIRS.has(entry.name) : !DEV_ONLY_FILE.test(entry.name))
    return [...src.map((file) => slash(relative(packageRoot, file))), "tsconfig.build.json", "scripts/copy-css.mjs"].sort()
}

/** The digest of everything that decides the content of `dist/`. */
export function sourceDigest(packageRoot) {
    const entries = sourceInputs(packageRoot).map((name) => {
        const file = join(packageRoot, name)
        return [name, existsSync(file) ? normalised(readFileSync(file)) : null]
    })
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
    entries.push(["package.json#exports+files", Buffer.from(JSON.stringify({ exports: manifest.exports ?? null, files: manifest.files ?? null }))])
    return hashEntries(entries)
}

/** The digest of the built files themselves (everything in `dist/` except the stamp). */
export function distDigest(packageRoot) {
    const dist = join(packageRoot, "dist")
    const files = filesUnder(dist).map((file) => slash(relative(dist, file))).filter((name) => name !== STAMP_FILE)
    return hashEntries(files.map((name) => [name, normalised(readFileSync(join(dist, name)))]))
}

export function writeStamp(packageRoot, { now = new Date() } = {}) {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
    if (!existsSync(join(packageRoot, "dist"))) throw new Error("Cannot stamp a build that has no dist/ directory.")
    const stamp = {
        schema: STAMP_SCHEMA,
        package: manifest.name,
        version: manifest.version,
        algorithm: DIGEST_ALGORITHM,
        sourceDigest: sourceDigest(packageRoot),
        distDigest: distDigest(packageRoot),
        builtAt: now.toISOString(),
    }
    writeFileSync(join(packageRoot, "dist", STAMP_FILE), `${JSON.stringify(stamp, null, 2)}\n`)
    return stamp
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
    const stamp = writeStamp(packageRoot)
    console.log(`dist/${STAMP_FILE}: ${stamp.package}@${stamp.version} ${stamp.sourceDigest.slice(0, 19)}`)
}
