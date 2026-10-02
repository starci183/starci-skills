import { Args, Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { @@Action@@Command } from "../../application/@@action@@.command"
import { to@@Action@@Request, to@@Action@@Type } from "./@@action@@.mapper"
import { @@Action@@Input } from "./dto/@@action@@.input"
import { @@Action@@Type } from "./dto/@@action@@.type"

@Resolver()
/** GraphQL door of @@actionCamel@@. */
export class @@Action@@Resolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs @@action@@ for the caller. */
    @Mutation(() => @@Action@@Type, { name: "@@actionCamel@@" })
    async @@actionCamel@@(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: @@Action@@Input,
    ): Promise<@@Action@@Type> {
        const result = await this.commandBus.execute(
            new @@Action@@Command({ request: to@@Action@@Request(input), principal }),
        )
        return to@@Action@@Type(result)
    }
}
