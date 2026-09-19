import {
    createHash, randomBytes 
} from "node:crypto"

/**
 * A run-scoped opaque token: unique compose project/volume names and per-run material that
 * only has to not collide, not stay stable between runs (that is what specHash is for).
 */
export function runToken(bytes = 6): string {
    return randomBytes(bytes).toString("hex")
}

/** Run-scoped secret material (a stack's generated passwords), never committed or reused. */
export function secret(bytes = 24): string {
    return randomBytes(bytes).toString("base64url")
}

/**
 * Short stable hash of a spec id, so each spec's compose project name is distinct yet
 * recognisable - the same spec always lands on the same project name, which is what lets a
 * boot reset the leftovers of an interrupted earlier run of itself.
 */
export function specHash(specId: string): string {
    return createHash("sha1").update(specId).digest("hex").slice(0,
        8)
}
