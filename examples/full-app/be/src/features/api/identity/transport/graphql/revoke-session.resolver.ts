import { Args, Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { SessionError } from "@modules/domain/session"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { RevokeSessionCommand } from "../../application/revoke-session.command"
import { RevokeSessionInput } from "./dto/revoke-session.input"
import { RevokeSessionType } from "./dto/revoke-session.type"
import { toRevokeSessionRequest, toRevokeSessionType } from "./revoke-session.mapper"

@Resolver()
/** GraphQL door of revokeSession: ends one of the caller own sessions. */
export class RevokeSessionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Ends the session of a bearer token that belongs to the caller. */
    @Mutation(() => RevokeSessionType, { name: "revokeSession" })
    async revokeSession(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: RevokeSessionInput,
    ): Promise<RevokeSessionType> {
        const outcome = await this.commandBus.execute(
            new RevokeSessionCommand({ request: toRevokeSessionRequest(input), principal }),
        )
        return toRevokeSessionType(unwrapOutcome(outcome, SessionError))
    }
}
