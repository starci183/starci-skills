import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { RecurError } from "@modules/domain/recur"
import { CurrentPrincipal } from "@modules/domain/session"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { UpcomingOccurrencesQuery } from "../../application/upcoming-occurrences.query"
import { UpcomingOccurrencesInput } from "./dto/upcoming-occurrences.input"
import { UpcomingOccurrencesType } from "./dto/upcoming-occurrences.type"
import { toUpcomingOccurrencesRequest, toUpcomingOccurrencesType } from "./upcoming-occurrences.mapper"

@Resolver()
/** GraphQL door of upcomingOccurrences. */
export class UpcomingOccurrencesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The materialised occurrences of a rule of the caller and the dates it fires on next. */
    @Query(() => UpcomingOccurrencesType, {
        name: "upcomingOccurrences",
        description: "The materialised occurrences of a rule of the caller, with a live preview of the dates it fires on next.",
    })
    async upcomingOccurrences(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: UpcomingOccurrencesInput,
    ): Promise<UpcomingOccurrencesType> {
        const outcome = await this.queryBus.execute(
            new UpcomingOccurrencesQuery({ request: toUpcomingOccurrencesRequest(input), principal }),
        )
        return toUpcomingOccurrencesType(unwrapOutcome(outcome, RecurError))
    }
}
