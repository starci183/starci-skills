import { Args, Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal, Roles } from "@modules/domain/identity"
import { OrderError } from "@modules/domain/order"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { GetOrderReceiptQuery } from "../../application/get-order-receipt.query"
import { OrderReceiptInput } from "./dto/order-receipt.input"
import { OrderReceiptType } from "./dto/order-receipt.type"
import { toOrderReceiptRequest, toOrderReceiptType } from "./order-receipt.mapper"

@Resolver()
/** GraphQL door of orderReceipt: the buyer downloads the receipt of their own order through a link that expires. */
export class OrderReceiptResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** A download link of the caller's receipt of one order. */
    @Query(() => OrderReceiptType, { name: "orderReceipt" })
    @Roles("member")
    async orderReceipt(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: OrderReceiptInput,
    ): Promise<OrderReceiptType> {
        const outcome = await this.queryBus.execute(
            new GetOrderReceiptQuery({ request: toOrderReceiptRequest(input), principal }),
        )
        return toOrderReceiptType(unwrapOutcome(outcome, OrderError))
    }
}
