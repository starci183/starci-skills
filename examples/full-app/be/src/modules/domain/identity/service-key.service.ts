import { createHash, timingSafeEqual } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { bearerTokenOf } from "./bearer-token.mapper"
import type { CredentialAuthenticator, CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { InjectIdentityOptions } from "./identity.decorators"
import type { IdentityOptions } from "./identity.options"

/** The workspace a service principal acts for: the services of this product, never a shopper's. */
const SERVICE_WORKSPACE = "services"

/** A fixed-length digest, so the comparison of two keys takes the same time whatever their length or content. */
const digestOf = (value: string): Buffer => createHash("sha256").update(value).digest()

@Injectable()
/**
 * Authenticates a calling service on an `api-key` door: the request's bearer value must equal the key one named service
 * holds. Every key is compared in constant time; an absent, unknown or wrong key, or a door of another credential kind, is
 * refused as unauthenticated without naming which.
 */
export class ServiceKeyService implements CredentialAuthenticator {
    constructor(@InjectIdentityOptions() private readonly options: IdentityOptions) {}

    /** The service the presented key belongs to, as an `api-key` principal of the services workspace. */
    async authenticate(metadata: CredentialMetadata, authorization: string): Promise<CredentialPrincipal> {
        const presented = bearerTokenOf(authorization)
        if (metadata.kind !== "api-key" || presented === null) {
            throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        }
        const presentedDigest = digestOf(presented)
        const services = Object.entries(this.options.serviceKeys ?? {})
            .filter(([, key]) => timingSafeEqual(digestOf(key.reveal()), presentedDigest))
            .map(([service]) => service)
        const [service] = services
        if (services.length !== 1 || service === undefined) {
            throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        }
        return { kind: "api-key", subject: service, workspaceId: SERVICE_WORKSPACE }
    }
}
