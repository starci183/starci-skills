import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata, PublicReason } from "./identity.contracts"

/**
 * The default-deny decision of one door: a door that states why it is public is admitted; every other door is refused
 * until the design that adds sign-in establishes a caller here.
 */
export const admit = (metadata: PublicMetadata | undefined): Outcome<PublicReason, IdentityErrorCode> =>
    metadata === undefined ? refused(IdentityErrorCode.Unauthenticated) : ok(metadata.reason)
