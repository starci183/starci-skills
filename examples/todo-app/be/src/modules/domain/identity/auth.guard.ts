import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectReflector } from "@modules/platform/composition"
import type { Role } from "@modules/platform/cqrs"
import { requestOf } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { bearerTokenOf } from "./bearer-token.mapper"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PUBLIC_KEY, ROLES_KEY } from "./identity.decorators"
import { SessionService } from "./session.service"

@Injectable()
/**
 * The third app guard and the default-deny gate: a door is open only when it says `@Public({ reason })`; every other
 * door needs a bearer token that names a live session, and the principal it establishes travels on the request.
 */
export class AuthGuard implements CanActivate {
    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectClock() private readonly clock: Clock,
        private readonly sessions: SessionService,
    ) {}

    /** Lets public doors through; otherwise authenticates the bearer token, checks the roles and stamps the principal. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const targets = [context.getHandler(), context.getClass()]
        if (this.reflector.getAllAndOverride<PublicMetadata | undefined>(PUBLIC_KEY, targets)) return true
        const request = requestOf(context)
        const token = bearerTokenOf(request.headers.authorization) ?? ""
        const session = unwrapOutcome(await this.sessions.find({ token, at: this.clock.now() }), IdentityError)
        const principal = this.sessions.principalOf(session.personId)
        const required = this.reflector.getAllAndOverride<ReadonlyArray<Role> | undefined>(ROLES_KEY, targets) ?? []
        if (!required.every((role) => principal.roles.includes(role))) {
            throw new IdentityError({ code: IdentityErrorCode.Forbidden })
        }
        request.principal = principal
        return true
    }
}
