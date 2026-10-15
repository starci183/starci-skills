import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

/**
 * The default-deny decision of one door: a door with a canonical public reason is admitted; every other door is refused
 * until the design that adds sign-in establishes a caller here.
 */
export const admit = (metadata: PublicMetadata | undefined): Outcome<PublicReason, IdentityErrorCode> => {
    switch (metadata?.reason) {
        case PublicReason.Health:
        case PublicReason.AuthHandshake:
        case PublicReason.SignedWebhook:
        case PublicReason.CatalogRead:
            return ok(metadata.reason)
        default:
            return refused(IdentityErrorCode.Unauthenticated)
    }
}
