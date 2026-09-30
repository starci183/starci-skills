import { Args, Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal, Roles } from "@modules/domain/identity"
import { OrderError } from "@modules/domain/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { PlaceOrderCommand } from "../../application/place-order.command"
import { PlaceOrderInput } from "./dto/place-order.input"
import { PlaceOrderType } from "./dto/place-order.type"
import { toPlaceOrderRequest, toPlaceOrderType } from "./place-order.mapper"

@Resolver()
/** GraphQL door of placeOrder. */
export class PlaceOrderResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Turns the caller cart into a confirmed order; only a member may buy. */
    @Mutation(() => PlaceOrderType, { name: "placeOrder" })
    @Roles("member")
    async placeOrder(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: PlaceOrderInput,
    ): Promise<PlaceOrderType> {
        const outcome = await this.commandBus.execute(
            new PlaceOrderCommand({ request: toPlaceOrderRequest(input), principal }),
        )
        return toPlaceOrderType(unwrapOutcome(outcome, OrderError))
    }
}
