import { Args, Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetBookingStatusQuery } from "../../application/get-booking-status.query"
import { GetBookingStatusInput } from "./dto/get-booking-status.input"
import { GetBookingStatusType } from "./dto/get-booking-status.type"
import { toGetBookingStatusRequest, toGetBookingStatusType } from "./get-booking-status.mapper"

@Resolver()
/** GraphQL door of get-booking-status: the confirmation status the front end polls after booking. */
export class GetBookingStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers the status of one booking the caller owns; another owner's booking is not found. */
    @Query(() => GetBookingStatusType, { name: "bookingStatus" })
    async bookingStatus(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: GetBookingStatusInput,
    ): Promise<GetBookingStatusType> {
        const result = await this.queryBus.execute(
            new GetBookingStatusQuery({ request: toGetBookingStatusRequest(input), principal }),
        )
        return toGetBookingStatusType(result)
    }
}
