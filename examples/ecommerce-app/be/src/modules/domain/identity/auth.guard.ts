import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectReflector } from "@modules/platform/composition"
import type { Principal, Role } from "@modules/platform/cqrs"
import { requestOf } from "@modules/platform/http-security"
import type { OperationRequest } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { admit } from "./admission.policy"
import { bearerTokenOf } from "./bearer-token.mapper"
import type { CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata, SessionVerifier } from "./identity.contracts"
import { CREDENTIAL_KEY, InjectSessionVerifier, PUBLIC_KEY, ROLES_KEY } from "./identity.decorators"

@Injectable()
/**
 * The fourth app guard and the default-deny gate: credential-marked doors need the credential principal established
 * by CredentialGuard, public doors state their reason, and every other door needs a live session. It calls no guard.
 */
export class AuthGuard implements CanActivate {
    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectSessionVerifier() private readonly verifier: SessionVerifier,
    ) {}

    /** Admits credential and public doors; otherwise verifies the session, checks roles and stamps the principal. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const targets = [context.getHandler(), context.getClass()]
        const credential = this.reflector.getAllAndOverride<CredentialMetadata | undefined>(CREDENTIAL_KEY, targets)
        const metadata = this.reflector.getAllAndOverride<PublicMetadata | undefined>(PUBLIC_KEY, targets)
        if (credential !== undefined) {
            const request: OperationRequest & { credentialPrincipal?: CredentialPrincipal } = requestOf(context)
            unwrapOutcome(admit(metadata, { required: credential, principal: request.credentialPrincipal }), IdentityError)
            return true
        }
        if (admit(metadata).kind === "ok") return true
        const request = requestOf(context)
        const token = bearerTokenOf(request.headers.authorization)
        const session = token === null ? null : await this.verifier.verify(token)
        if (session === null) throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        const principal: Principal = { id: session.personId, roles: ["member"] }
        const required = this.reflector.getAllAndOverride<ReadonlyArray<Role> | undefined>(ROLES_KEY, targets) ?? []
        if (!required.every((role) => principal.roles.includes(role))) {
            throw new IdentityError({ code: IdentityErrorCode.Forbidden })
        }
        request.principal = principal
        return true
    }
}
