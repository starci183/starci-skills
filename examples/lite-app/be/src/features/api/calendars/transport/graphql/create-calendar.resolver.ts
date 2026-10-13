import { Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateCalendarCommand } from "../../application/create-calendar.command"
import { toCreateCalendarType } from "./create-calendar.mapper"
import { CreateCalendarType } from "./dto/create-calendar.type"

@Resolver()
/** GraphQL door of create-calendar: a new calendar row owned by the caller. */
export class CreateCalendarResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates one calendar row for the caller. */
    @Mutation(() => CreateCalendarType, { name: "createCalendar" })
    async createCalendar(@CurrentPrincipal() principal: Principal): Promise<CreateCalendarType> {
        const result = await this.commandBus.execute(new CreateCalendarCommand({ request: {}, principal }))
        return toCreateCalendarType(result)
    }
}
