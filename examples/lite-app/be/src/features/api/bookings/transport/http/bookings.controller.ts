import { Body, Controller, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import type { Principal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { BookingsCommand } from "../../application/bookings.command"
import { toBookingsRequest, toBookingsResponse } from "./bookings.mapper"
import { BookingsRequestDto } from "./dto/bookings.request"
import { BookingsResponseDto } from "./dto/bookings.response"

@Controller("bookings")
/** HTTP door of bookings. */
export class BookingsController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs bookings for the authenticated caller. */
    @Post()
    async bookings(
        @CurrentPrincipal() principal: Principal,
        @Body() input: BookingsRequestDto,
    ): Promise<BookingsResponseDto> {
        const result = await this.commandBus.execute(
            new BookingsCommand({ request: toBookingsRequest(input), principal }),
        )
        return toBookingsResponse(result)
    }
}
