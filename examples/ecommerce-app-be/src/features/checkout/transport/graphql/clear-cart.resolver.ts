import { Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ClearCartCommand } from "../../application/clear-cart.command"
import { toClearCartType } from "./clear-cart.mapper"
import { ClearCartType } from "./dto/clear-cart.type"

@Resolver()
/** GraphQL door of clearCart. */
export class ClearCartResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Empties the caller cart. */
    @Mutation(() => ClearCartType, { name: "clearCart" })
    async clearCart(@CurrentPrincipal() principal: Principal): Promise<ClearCartType> {
        const result = await this.commandBus.execute(new ClearCartCommand({ request: {}, principal }))
        return toClearCartType(result)
    }
}
