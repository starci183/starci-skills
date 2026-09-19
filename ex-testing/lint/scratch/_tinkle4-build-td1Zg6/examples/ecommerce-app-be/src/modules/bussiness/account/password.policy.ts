import {
    Injectable 
} from "@nestjs/common"
import {
    scryptSync, timingSafeEqual 
} from "node:crypto"

/**
 * The demo credential scheme: scrypt with a fixed per-example salt, verified in constant time.
 * A real product delegates passwords to an identity provider (todo's login feature shows that
 * shape with Keycloak); this example keeps the verification local and honest about it being a
 * demo - the seeded hash in the migration is computed with exactly this salt.
 *
 * DEMO_SCRYPT_SALT is a key-derivation salt, not a credential: it is published in the migration's
 * own doc block and carries no secrecy, so it is safe to keep in source and its name says what it
 * is rather than implying a hidden password. The VALUE is pinned because the demo row seeded by
 * 1789800000000-create-identity-tables.ts stores the scrypt hash computed with it - changing the
 * value silently breaks that login, it needs the seed hash recomputed in the same change.
 */
export const DEMO_SCRYPT_SALT = "ecommerce-app-demo"

@Injectable()
/**
 * Hashes and verifies passwords against DEMO_SCRYPT_SALT. `hash` runs at registration, `verify`
 * at sign-in; both keep the comparison constant-time so a wrong length never leaks timing.
 */
export class PasswordPolicy {
    hash(plain: string): string {
        return scryptSync(plain,
            DEMO_SCRYPT_SALT,
            64).toString("hex")
    }

    verify(plain: string, storedHashHex: string): boolean {
        const candidate = Buffer.from(scryptSync(plain,
            DEMO_SCRYPT_SALT,
            64).toString("hex"))
        const stored = Buffer.from(storedHashHex)
        if (candidate.length !== stored.length) return false
        return timingSafeEqual(candidate,
            stored)
    }
}
