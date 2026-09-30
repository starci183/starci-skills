import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { PlanError } from "@modules/domain/plan"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { ReconcilePaymentCommand } from "../../application/reconcile-payment.command"
import { ReconcilePaymentInput } from "./dto/reconcile-payment.input"
import { ReconcilePaymentType } from "./dto/reconcile-payment.type"
import { toReconcilePaymentRequest, toReconcilePaymentType } from "./reconcile-payment.mapper"

@Resolver()
/** GraphQL door of reconcilePayment. */
export class ReconcilePaymentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Asks the gateway about a payment intent of the caller and applies what a webhook would have applied. */
    @Mutation(() => ReconcilePaymentType, {
        name: "reconcilePayment",
        description: "Ask the payment gateway for the state of a pending payment and apply it.",
    })
    async reconcilePayment(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: ReconcilePaymentInput,
    ): Promise<ReconcilePaymentType> {
        const outcome = await this.commandBus.execute(
            new ReconcilePaymentCommand({ request: toReconcilePaymentRequest(input), principal }),
        )
        return toReconcilePaymentType(unwrapOutcome(outcome, PlanError))
    }
}
