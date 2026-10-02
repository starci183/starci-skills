import { Args, Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { PublicReason, Public } from "@modules/domain/identity"
import { SessionError } from "@modules/domain/session"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { VerifySessionQuery } from "../../application/verify-session.query"
import { VerifySessionInput } from "./dto/verify-session.input"
import { VerifySessionType } from "./dto/verify-session.type"
import { toVerifySessionRequest, toVerifySessionType } from "./verify-session.mapper"

@Resolver()
/** GraphQL door of verifySession: the handshake other services use to check a bearer token, on the strict rate tier. */
export class VerifySessionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Names the person behind a live bearer token. */
    @Query(() => VerifySessionType, { name: "verifySession" })
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    async verifySession(@Args("input") input: VerifySessionInput): Promise<VerifySessionType> {
        const outcome = await this.queryBus.execute(new VerifySessionQuery({ request: toVerifySessionRequest(input) }))
        return toVerifySessionType(unwrapOutcome(outcome, SessionError))
    }
}
