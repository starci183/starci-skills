import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { IdentityErrorCode } from "./errors/identity.error"
import type { IdentityAdmission, Principal, PublicMetadata } from "./identity.contracts"

/** Admits an explicitly public door or a verified principal; everything else is refused. */
export const admit = (
    metadata: PublicMetadata | undefined,
    principal: Principal | undefined,
): Outcome<IdentityAdmission, IdentityErrorCode> => {
    if (metadata !== undefined) return ok(metadata.reason)
    return principal === undefined ? refused(IdentityErrorCode.Unauthenticated) : ok(principal)
}
