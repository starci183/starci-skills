import { Args, Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { Get{{Singular}}Query } from "../../application/get-{{singular}}.query"
import { Get{{Singular}}Input } from "./dto/get-{{singular}}.input"
import { Get{{Singular}}Type } from "./dto/get-{{singular}}.type"
import { toGet{{Singular}}Request, toGet{{Singular}}Type } from "./get-{{singular}}.mapper"

@Resolver()
/** GraphQL door of get-{{singular}}: one {{singular}} row of the caller. */
export class Get{{Singular}}Resolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers one {{singular}} row the caller owns; another owner's row is not found. */
    @Query(() => Get{{Singular}}Type, { name: "{{singularCamel}}" })
    async {{singularCamel}}(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: Get{{Singular}}Input,
    ): Promise<Get{{Singular}}Type> {
        const result = await this.queryBus.execute(
            new Get{{Singular}}Query({ request: toGet{{Singular}}Request(input), principal }),
        )
        return toGet{{Singular}}Type(result)
    }
}
