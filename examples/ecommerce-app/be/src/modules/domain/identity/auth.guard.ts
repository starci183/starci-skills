import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectReflector } from "@modules/platform/composition"
import type { Principal, Role } from "@modules/platform/cqrs"
import { requestOf } from "@modules/platform/http-security"
import { bearerTokenOf } from "./bearer-token.mapper"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata, SessionVerifier } from "./identity.contracts"
import { InjectSessionVerifier, PUBLIC_KEY, ROLES_KEY } from "./identity.decorators"

@Injectable()
/**
 * The third app guard and the default-deny gate: a door is open only when it says `@Public({ reason })`; every other
 * door needs a bearer token the SessionVerifier accepts, and the principal it names travels on the request.
 */
export class AuthGuard implements CanActivate {
    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectSessionVerifier() private readonly verifier: SessionVerifier,
    ) {}

    /** Lets public doors through; otherwise authenticates the bearer token, checks the roles and stamps the principal. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const targets = [context.getHandler(), context.getClass()]
        if (this.reflector.getAllAndOverride<PublicMetadata | undefined>(PUBLIC_KEY, targets)) return true
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
