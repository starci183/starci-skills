import { randomBytes } from "node:crypto"

/** A run-scoped opaque token: unique container names and per-run material that only has to not collide. */
export function runToken(bytes = 6): string {
    return randomBytes(bytes).toString("hex")
}

/** Run-scoped secret material (generated passwords and signing keys), never committed or reused. */
export function secret(bytes = 24): string {
    return randomBytes(bytes).toString("base64url")
}
