import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListCollaboratorsQuery } from "../../application/list-collaborators.query"
import { ListCollaboratorsInput } from "./dto/list-collaborators.input"
import { ListCollaboratorsType } from "./dto/list-collaborators.type"
import { toListCollaboratorsRequest, toListCollaboratorsType } from "./list-collaborators.mapper"

@Resolver()
/** GraphQL door of collaborators. */
export class ListCollaboratorsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The invitations on a task, visible to its owner and to bound collaborators. */
    @Query(() => [ListCollaboratorsType], { name: "collaborators" })
    async collaborators(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: ListCollaboratorsInput,
    ): Promise<Array<ListCollaboratorsType>> {
        const result = await this.queryBus.execute(
            new ListCollaboratorsQuery({ request: toListCollaboratorsRequest(input), principal }),
        )
        return toListCollaboratorsType(result)
    }
}
