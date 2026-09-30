import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { AuditError } from "@modules/domain/audit"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { CompleteErasureCommand } from "../../application/complete-erasure.command"
import { toCompleteErasureRequest, toCompleteErasureType } from "./complete-erasure.mapper"
import { CompleteErasureInput } from "./dto/complete-erasure.input"
import { CompleteErasureType } from "./dto/complete-erasure.type"

@Resolver()
/** GraphQL door of completeErasure. */
export class CompleteErasureResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Completes the verified erasure request of the caller: the subject key is destroyed and the request anonymized. */
    @Mutation(() => CompleteErasureType, {
        name: "completeErasure",
        description: "Complete a verified erasure request: destroy the subject key, then confirm and log completion.",
    })
    async completeErasure(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: CompleteErasureInput,
    ): Promise<CompleteErasureType> {
        const outcome = await this.commandBus.execute(
            new CompleteErasureCommand({ request: toCompleteErasureRequest(input), principal }),
        )
        return toCompleteErasureType(unwrapOutcome(outcome, AuditError))
    }
}
