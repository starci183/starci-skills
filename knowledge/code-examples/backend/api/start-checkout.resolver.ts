// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { Args, Mutation, Resolver } from "@nestjs/graphql"
//   import { CurrentPrincipal } from "@modules/domain/identity"
//   import type { Principal } from "@modules/domain/identity"
//   import { InjectCommandBus, unwrapOutcome } from "@modules/platform/cqrs"
//   import type { CommandBus } from "@modules/platform/cqrs"
//   import { PurchaseError } from "@modules/domain/order"
//   import { StartCheckoutCommand } from "../../application/start-checkout.command"
//   import { StartCheckoutInput } from "./dto/start-checkout.input"
//   import { StartCheckoutType } from "./dto/start-checkout.type"
//   import { toStartCheckoutRequest, toStartCheckoutType } from "./start-checkout.mapper"

@Resolver()
/** GraphQL door of startCheckout: it maps, dispatches one command and maps the result. */
export class StartCheckoutResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    @Mutation(() => StartCheckoutType, { name: "startCheckout" })
    async startCheckout(@CurrentPrincipal() principal: Principal, @Args("input") input: StartCheckoutInput): Promise<StartCheckoutType> {
        const outcome = await this.commandBus.execute(new StartCheckoutCommand({ request: toStartCheckoutRequest(input), principal }))
        return toStartCheckoutType(unwrapOutcome(outcome, PurchaseError))
    }
}
