import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { ShareError } from "@modules/domain/share"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { RevokeCollaboratorCommand } from "../../application/revoke-collaborator.command"
import { RevokeCollaboratorInput } from "./dto/revoke-collaborator.input"
import { RevokeCollaboratorType } from "./dto/revoke-collaborator.type"
import { toRevokeCollaboratorRequest, toRevokeCollaboratorType } from "./revoke-collaborator.mapper"

@Resolver()
/** GraphQL door of revokeCollaborator. */
export class RevokeCollaboratorResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Revokes a collaborator invitation the caller owns; access ends with the commit. */
    @Mutation(() => RevokeCollaboratorType, { name: "revokeCollaborator" })
    async revokeCollaborator(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: RevokeCollaboratorInput,
    ): Promise<RevokeCollaboratorType> {
        const outcome = await this.commandBus.execute(
            new RevokeCollaboratorCommand({ request: toRevokeCollaboratorRequest(input), principal }),
        )
        return toRevokeCollaboratorType(unwrapOutcome(outcome, ShareError))
    }
}
