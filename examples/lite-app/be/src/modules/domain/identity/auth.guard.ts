import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectSupabaseAccessTokenVerifier } from "@modules/integrations/supabase"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { InjectReflector } from "@modules/platform/composition"
import type { Principal } from "@modules/platform/cqrs"
import { requestOf } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { admit } from "./admission.policy"
import { IdentityError } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PUBLIC_KEY } from "./identity.decorators"

const bearerToken = (authorization: string | undefined): string | undefined => {
    const [scheme, token, extra] = authorization?.split(" ") ?? []
    return scheme?.toLowerCase() === "bearer" && token && extra === undefined ? token : undefined
}

@Injectable()
/** The third app guard and default-deny gate: non-public doors require a verified Supabase principal. */
export class AuthGuard implements CanActivate {
    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectSupabaseAccessTokenVerifier()
        private readonly verifyAccessToken: VerifySupabaseAccessToken,
    ) {}

    /** Verifies the bearer token when the door is not public, then applies the admission policy. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const metadata = this.reflector.getAllAndOverride<PublicMetadata | undefined>(PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ])
        let principal: Principal | undefined
        if (metadata === undefined) {
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
        unwrapOutcome(admit(metadata, principal), IdentityError)
        return true
    }
}
