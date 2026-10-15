import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { IdentityErrorCode } from "./errors/identity.error"
import type { Principal } from "@modules/platform/cqrs"
import type { IdentityAdmission, PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

/** Admits an explicitly public door or a verified principal; everything else is refused. */
export const admit = (
    metadata: PublicMetadata | undefined,
    principal: Principal | undefined,
): Outcome<IdentityAdmission, IdentityErrorCode> => {
    switch (metadata?.reason) {
        case PublicReason.Health:
        case PublicReason.AuthHandshake:
        case PublicReason.SignedWebhook:
        case PublicReason.CatalogRead:
            return ok(metadata.reason)
        case undefined:
        default:
            break
    }
    return principal === undefined ? refused(IdentityErrorCode.Unauthenticated) : ok(principal)
}
