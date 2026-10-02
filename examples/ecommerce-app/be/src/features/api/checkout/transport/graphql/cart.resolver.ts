import { Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetCartQuery } from "../../application/get-cart.query"
import { toCartType } from "./cart.mapper"
import { CartType } from "./dto/cart.type"

@Resolver()
/** GraphQL door of cart. */
export class CartResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The caller cart with the catalog it prices against. */
    @Query(() => CartType, { name: "cart" })
    async cart(@CurrentPrincipal() principal: Principal): Promise<CartType> {
        const view = await this.queryBus.execute(new GetCartQuery({ request: {}, principal }))
        return toCartType(view)
    }
}
