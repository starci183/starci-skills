import { Args, Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { OrderError } from "@modules/domain/order"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { ListOrdersQuery } from "../../application/list-orders.query"
import { OrdersType } from "./dto/orders.type"
import { PageArgs } from "./dto/page.args"
import { toListOrdersRequest, toOrdersType } from "./orders.mapper"

@Resolver()
/** GraphQL door of orders: the caller pages through their own orders by cursor. */
export class OrdersResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** One page of the caller's orders, newest first. */
    @Query(() => OrdersType, { name: "orders" })
    async orders(@CurrentPrincipal() principal: Principal, @Args() page: PageArgs): Promise<OrdersType> {
        const outcome = await this.queryBus.execute(
            new ListOrdersQuery({ request: toListOrdersRequest(page), principal }),
        )
        return toOrdersType(unwrapOutcome(outcome, OrderError))
    }
}
