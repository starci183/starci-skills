import { Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/auth"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetBuyerStatusQuery } from "../../application/get-buyer-status.query"
import { toBuyerStatusType } from "./buyer-status.mapper"
import { BuyerStatusType } from "./dto/buyer-status.type"

@Resolver()
/** GraphQL door of buyerStatus: the identity service asks it with the bearer token of the caller. */
export class BuyerStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Whether the caller has confirmed orders. */
    @Query(() => BuyerStatusType, { name: "buyerStatus" })
    async buyerStatus(@CurrentPrincipal() principal: Principal): Promise<BuyerStatusType> {
        const status = await this.queryBus.execute(new GetBuyerStatusQuery({ request: {}, principal }))
        return toBuyerStatusType(status)
    }
}
