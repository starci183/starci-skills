import { Args, Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { OrderError } from "@modules/domain/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { AddCartItemCommand } from "../../application/add-cart-item.command"
import { toAddCartItemRequest, toAddCartItemType } from "./add-cart-item.mapper"
import { AddCartItemInput } from "./dto/add-cart-item.input"
import { AddCartItemType } from "./dto/add-cart-item.type"

@Resolver()
/** GraphQL door of addCartItem. */
export class AddCartItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds units of a product to the caller cart. */
    @Mutation(() => AddCartItemType, { name: "addCartItem" })
    async addCartItem(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: AddCartItemInput,
    ): Promise<AddCartItemType> {
        const outcome = await this.commandBus.execute(
            new AddCartItemCommand({ request: toAddCartItemRequest(input), principal }),
        )
        return toAddCartItemType(unwrapOutcome(outcome, OrderError))
    }
}
