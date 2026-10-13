import { Args, Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateBookingCommand } from "../../application/create-booking.command"
import { toCreateBookingRequest, toCreateBookingType } from "./create-booking.mapper"
import { CreateBookingInput } from "./dto/create-booking.input"
import { CreateBookingType } from "./dto/create-booking.type"

@Resolver()
/** GraphQL door of create-booking: a pending booking of the caller whose confirmation job is enqueued with it. */
export class CreateBookingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Books a resource of the caller; the answer is pending, and bookingStatus reports when the confirmation job ran. */
    @Mutation(() => CreateBookingType, { name: "createBooking" })
    async createBooking(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: CreateBookingInput,
    ): Promise<CreateBookingType> {
        const result = await this.commandBus.execute(
            new CreateBookingCommand({ request: toCreateBookingRequest(input), principal }),
        )
        return toCreateBookingType(result)
    }
}
