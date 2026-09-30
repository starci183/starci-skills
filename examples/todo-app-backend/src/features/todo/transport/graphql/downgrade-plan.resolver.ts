import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DowngradePlanCommand } from "../../application/downgrade-plan.command"
import { toDowngradePlanType } from "./downgrade-plan.mapper"
import { DowngradePlanType } from "./dto/downgrade-plan.type"

@Resolver()
/** GraphQL door of downgradePlan. */
export class DowngradePlanResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Returns the caller to the free plan at once. */
    @Mutation(() => DowngradePlanType, {
        name: "downgradePlan",
        description: "Return to the free plan, effective at once. Tasks are untouched; the cap applies from the next create.",
    })
    async downgradePlan(@CurrentPrincipal() principal: Principal): Promise<DowngradePlanType> {
        const result = await this.commandBus.execute(new DowngradePlanCommand({ request: {}, principal }))
        return toDowngradePlanType(result)
    }
}
