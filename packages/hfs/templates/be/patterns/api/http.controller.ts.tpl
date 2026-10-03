import { Body, Controller, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { @@Action@@Command } from "../../application/@@action@@.command"
import { to@@Action@@Request, to@@Action@@Response } from "./@@action@@.mapper"
import { @@Action@@Request } from "./dto/@@action@@.request"
import { @@Action@@Response } from "./dto/@@action@@.response"

@Controller("@@feature@@")
/** HTTP door of @@actionCamel@@. */
export class @@Action@@Controller {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs @@action@@ for the authenticated caller. */
    @Post()
    async @@actionCamel@@(
        @CurrentPrincipal() principal: Principal,
        @Body() input: @@Action@@Request,
    ): Promise<@@Action@@Response> {
        const result = await this.commandBus.execute(
            new @@Action@@Command({ request: to@@Action@@Request(input), principal }),
        )
        return to@@Action@@Response(result)
    }
}
