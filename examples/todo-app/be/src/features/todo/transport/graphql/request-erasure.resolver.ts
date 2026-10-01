import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { AuditError } from "@modules/domain/audit"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { RequestErasureCommand } from "../../application/request-erasure.command"
import { RequestErasureType } from "./dto/request-erasure.type"
import { toRequestErasureType } from "./request-erasure.mapper"

@Resolver()
/** GraphQL door of requestErasure. */
export class RequestErasureResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Opens and verifies the erasure request of the caller, the only subject a person can ask to erase. */
    @Mutation(() => RequestErasureType, { name: "requestErasure" })
    async requestErasure(@CurrentPrincipal() principal: Principal): Promise<RequestErasureType> {
        const outcome = await this.commandBus.execute(new RequestErasureCommand({ request: {}, principal }))
        return toRequestErasureType(unwrapOutcome(outcome, AuditError))
    }
}
