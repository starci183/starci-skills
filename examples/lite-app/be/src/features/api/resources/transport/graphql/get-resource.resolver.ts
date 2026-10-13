import { Args, Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetResourceQuery } from "../../application/get-resource.query"
import { GetResourceInput } from "./dto/get-resource.input"
import { GetResourceType } from "./dto/get-resource.type"
import { toGetResourceRequest, toGetResourceType } from "./get-resource.mapper"

@Resolver()
/** GraphQL door of get-resource: one resource row of the caller. */
export class GetResourceResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers one resource row the caller owns; another owner's row is not found. */
    @Query(() => GetResourceType, { name: "resource" })
    async resource(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: GetResourceInput,
    ): Promise<GetResourceType> {
        const result = await this.queryBus.execute(
            new GetResourceQuery({ request: toGetResourceRequest(input), principal }),
        )
        return toGetResourceType(result)
    }
}
