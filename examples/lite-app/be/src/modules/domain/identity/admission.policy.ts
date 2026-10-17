import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { IdentityErrorCode } from "./errors/identity.error"
import type { Principal } from "@modules/platform/cqrs"
import type { IdentityAdmission, PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

/** What a credential-marked door requires and what `CredentialGuard` established for it. */
export interface CredentialAdmission {
    /** The `@Credential` metadata of the door. */
    readonly required: CredentialMetadata
    /** The principal `CredentialGuard` set on the request, when the credential authenticated. */
    readonly principal: CredentialPrincipal | undefined
}

const admitCredential = ({
    required,
    principal,
}: CredentialAdmission): Outcome<CredentialPrincipal, IdentityErrorCode> =>
    principal?.kind === required.kind ? ok(principal) : refused(IdentityErrorCode.Unauthenticated)

/** Admits a matching credential principal, a canonical public door or a verified session; everything else is refused. */
export const admit = (
    metadata: PublicMetadata | undefined,
    principal: Principal | undefined,
    credential?: CredentialAdmission,
): Outcome<IdentityAdmission, IdentityErrorCode> => {
    if (credential !== undefined) return admitCredential(credential)
    switch (metadata?.reason) {
        case PublicReason.Health:
        case PublicReason.SignedWebhook:
            return ok(metadata.reason)
        case undefined:
            return principal === undefined ? refused(IdentityErrorCode.Unauthenticated) : ok(principal)
        case PublicReason.AuthHandshake:
        case PublicReason.CatalogRead:
        default:
            return refused(IdentityErrorCode.Unauthenticated)
    }
}
