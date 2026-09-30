import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/session"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpgradePlanCommand } from "../../application/upgrade-plan.command"
import { UpgradePlanType } from "./dto/upgrade-plan.type"
import { toUpgradePlanType } from "./upgrade-plan.mapper"

@Resolver()
/** GraphQL door of upgradePlan. */
export class UpgradePlanResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts checkout for the paid plan and returns where the caller pays. */
    @Mutation(() => UpgradePlanType, {
        name: "upgradePlan",
        description: "Start checkout for the paid plan: records the pending subscription and payment intent and returns the checkout URL.",
    })
    async upgradePlan(@CurrentPrincipal() principal: Principal): Promise<UpgradePlanType> {
        const result = await this.commandBus.execute(new UpgradePlanCommand({ request: {}, principal }))
        return toUpgradePlanType(result)
    }
}
