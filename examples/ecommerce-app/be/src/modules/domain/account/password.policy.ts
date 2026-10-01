import { scryptSync, timingSafeEqual } from "node:crypto"

/**
 * The key-derivation salt of the demo credential scheme. It is not a secret: a real product delegates passwords to an
 * identity provider, this example keeps a local scrypt scheme and says so. The seed in `.starcistacks/dev/seeds`
 * stores hashes computed with this exact value.
 */
export const DEMO_SCRYPT_SALT = "ecommerce-app-demo"

const KEY_LENGTH = 64

const derive = (plain: string): Buffer => scryptSync(plain, DEMO_SCRYPT_SALT, KEY_LENGTH)

/** Hashes a password for storage. */
export const hashPassword = (plain: string): string => derive(plain).toString("hex")

/** Whether `plain` hashes to the stored hex; the comparison is constant-time. */
export const verifyPassword = (plain: string, storedHashHex: string): boolean => {
    const candidate = Buffer.from(hashPassword(plain))
    const stored = Buffer.from(storedHashHex)
    return candidate.length === stored.length && timingSafeEqual(candidate, stored)
}
