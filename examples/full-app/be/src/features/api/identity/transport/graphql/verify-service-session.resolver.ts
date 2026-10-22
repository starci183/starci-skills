import { Args, Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { Credential } from "@modules/domain/identity"
import { SessionError } from "@modules/domain/session"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { VerifySessionQuery } from "../../application/verify-session.query"
import { VerifySessionInput } from "./dto/verify-session.input"
import { VerifySessionType } from "./dto/verify-session.type"
import { toVerifySessionRequest, toVerifySessionType } from "./verify-session.mapper"

@Resolver()
/**
 * GraphQL door of verifyServiceSession: the same session check as verifySession, for the services that verify every request
 * a shopper sends them. It admits only a calling service's own key (`api-key` credential) and counts on the service tier, one
 * budget per service, so a shopper's traffic never meets the strict tier the public handshake keeps.
 */
export class VerifyServiceSessionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Names the person behind a live bearer token, for an authenticated calling service. */
    @Query(() => VerifySessionType, { name: "verifyServiceSession" })
    @Credential({ kind: "api-key" })
    @RateLimit(RateTier.Service)
    async verifyServiceSession(@Args("input") input: VerifySessionInput): Promise<VerifySessionType> {
        const outcome = await this.queryBus.execute(new VerifySessionQuery({ request: toVerifySessionRequest(input) }))
        return toVerifySessionType(unwrapOutcome(outcome, SessionError))
    }
}
