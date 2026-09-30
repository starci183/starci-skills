import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/session"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PlanUsageQuery } from "../../application/plan-usage.query"
import { PlanUsageType } from "./dto/plan-usage.type"
import { toPlanUsageType } from "./plan-usage.mapper"

@Resolver()
/** GraphQL door of planUsage. */
export class PlanUsageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The plan of the caller against the active tasks the caller holds. */
    @Query(() => PlanUsageType, {
        name: "planUsage",
        description: "The plan of the caller against the active tasks the caller holds; the cap is null on the paid plan.",
    })
    async planUsage(@CurrentPrincipal() principal: Principal): Promise<PlanUsageType> {
        const usage = await this.queryBus.execute(new PlanUsageQuery({ request: {}, principal }))
        return toPlanUsageType(usage)
    }
}
