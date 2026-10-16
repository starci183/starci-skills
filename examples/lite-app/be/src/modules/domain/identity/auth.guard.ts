import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { InjectReflector } from "@modules/platform/composition"
import type { Principal } from "@modules/platform/cqrs"
import { requestOf } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { admit } from "./admission.policy"
import type { CredentialMetadata } from "./credential.contracts"
import { IdentityError } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { CREDENTIAL_KEY, InjectAccessTokenVerifier, PUBLIC_KEY } from "./identity.decorators"

const bearerToken = (authorization: string | undefined): string | undefined => {
    const [scheme, token, extra] = authorization?.split(" ") ?? []
    return scheme?.toLowerCase() === "bearer" && token && extra === undefined ? token : undefined
}

@Injectable()
/**
 * The fourth app guard and default-deny gate: credential doors require the matching credential principal; other
 * non-public doors require a verified Supabase principal. It never calls another guard.
 */
export class AuthGuard implements CanActivate {
    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectAccessTokenVerifier() private readonly verifyAccessToken: VerifySupabaseAccessToken,
    ) {}

    /** Uses the established credential principal or verifies a non-public session, then applies the admission policy. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const targets = [context.getHandler(), context.getClass()]
        const required = this.reflector.getAllAndOverride<CredentialMetadata | undefined>(CREDENTIAL_KEY, targets)
        const metadata = this.reflector.getAllAndOverride<PublicMetadata | undefined>(PUBLIC_KEY, targets)
        const credential =
            required === undefined ? undefined : { required, principal: requestOf(context).credentialPrincipal }
        let principal: Principal | undefined
        if (required === undefined && metadata === undefined) {
            const request = requestOf(context)
            const token = bearerToken(request.headers.authorization)
            if (token !== undefined) {
                const verified = await this.verifyAccessToken(token)
                if (verified.kind === "ok") {
                    principal = verified.value
                    request.principal = verified.value
                }
            }
        }
        unwrapOutcome(admit(metadata, principal, credential), IdentityError)
        return true
    }
}
