import { Args, Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetCalendarQuery } from "../../application/get-calendar.query"
import { GetCalendarInput } from "./dto/get-calendar.input"
import { GetCalendarType } from "./dto/get-calendar.type"
import { toGetCalendarRequest, toGetCalendarType } from "./get-calendar.mapper"

@Resolver()
/** GraphQL door of get-calendar: one calendar row of the caller. */
export class GetCalendarResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers one calendar row the caller owns; another owner's row is not found. */
    @Query(() => GetCalendarType, { name: "calendar" })
    async calendar(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: GetCalendarInput,
    ): Promise<GetCalendarType> {
        const result = await this.queryBus.execute(
            new GetCalendarQuery({ request: toGetCalendarRequest(input), principal }),
        )
        return toGetCalendarType(result)
    }
}
