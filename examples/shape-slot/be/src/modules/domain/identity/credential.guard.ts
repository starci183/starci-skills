import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectReflector } from "@modules/platform/composition"
import { requestOf } from "@modules/platform/http-security"
import type { CredentialAuthenticator, CredentialMetadata } from "./credential.contracts"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { CREDENTIAL_KEY, InjectCredentialAuthenticator } from "./identity.decorators"

@Injectable()
/**
 * The third app guard: it acts only on a door marked `@Credential({ kind })`, authenticates the credential through the
 * identity-owned port and sets the request's credential principal. Every other door passes through untouched and
 * `AuthGuard` decides it.
 */
export class CredentialGuard implements CanActivate {
    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectCredentialAuthenticator() private readonly authenticator: CredentialAuthenticator,
    ) {}

    /** Authenticates a credential door and leaves every other door to `AuthGuard`. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const metadata = this.reflector.getAllAndOverride<CredentialMetadata | undefined>(CREDENTIAL_KEY, [
            context.getHandler(),
            context.getClass(),
        ])
        if (metadata === undefined) return true
        const request = requestOf(context)
        request.credentialPrincipal = undefined
        const id: unknown = request.params?.id
        const principal = await this.authenticator.authenticate(
            metadata,
            request.headers.authorization ?? "",
            typeof id === "string" ? id : undefined,
        )
        if (principal.kind !== metadata.kind || !principal.subject || !principal.workspaceId) {
            throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        }
        request.credentialPrincipal = principal
        return true
    }
}
