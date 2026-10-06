import { createHash, randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import type { Namespace } from "./contracts"

const MAX_SNAKE_LENGTH = 40
const HASH_LENGTH = 6

const packageNameOf = (root: string): string => {
    try {
        const parsed: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
        if (typeof parsed === "object" && parsed !== null && "name" in parsed && typeof parsed.name === "string" && parsed.name.length > 0) return parsed.name
    } catch {
        // no readable package.json: the directory name stands in
    }
    return basename(root)
}

/** The normalised form of a root that the namespace hash is taken over: absolute, forward slashes, lowercase, no trailing slash. */
export const normalisedRoot = (root: string): string => resolve(root).replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase()

/**
 * The isolation identity of one data slot of a checkout: `<package name slug>_<6 hex of sha256(normalised root)>_w<slot>`. Two
 * checkouts of the same package get different namespaces, and so do two slots of one run (each jest worker owns a slot); the
 * snake form is at most 40 characters so `<snake>_<connection>` fits a Postgres identifier.
 */
export const namespaceOf = (root: string, slot: number): Namespace => {
    if (!Number.isInteger(slot) || slot < 1) throw new RangeError(`a slot is a positive integer, got ${slot}`)
    const absolute = resolve(root)
    const unscoped = packageNameOf(absolute).replace(/^@[^/]+\//, "")
    let slug = unscoped
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((part) => part.length > 0)
        .join("_")
    if (slug === "") slug = "repo"
    if (/^\d/.test(slug)) slug = `r_${slug}`
    const hash = createHash("sha256").update(normalisedRoot(absolute)).digest("hex").slice(0, HASH_LENGTH)
    const suffix = `_${hash}_w${slot}`
    const trimmed = slug.slice(0, MAX_SNAKE_LENGTH - suffix.length).replace(/_+$/, "")
    const snake = `${trimmed}${suffix}`
    return { snake, kebab: snake.replaceAll("_", "-"), root: absolute }
}

/** A random run token of `bytes` bytes as lowercase hex (default 4, so 8 characters). */
export const runToken = (bytes = 4): string => randomBytes(bytes).toString("hex")
