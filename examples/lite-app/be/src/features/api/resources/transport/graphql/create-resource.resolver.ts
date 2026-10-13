import { Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateResourceCommand } from "../../application/create-resource.command"
import { toCreateResourceType } from "./create-resource.mapper"
import { CreateResourceType } from "./dto/create-resource.type"

@Resolver()
/** GraphQL door of create-resource: a new resource row owned by the caller. */
export class CreateResourceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates one resource row for the caller. */
    @Mutation(() => CreateResourceType, { name: "createResource" })
    async createResource(@CurrentPrincipal() principal: Principal): Promise<CreateResourceType> {
        const result = await this.commandBus.execute(new CreateResourceCommand({ request: {}, principal }))
        return toCreateResourceType(result)
    }
}
