import { Mutation, Resolver } from "@nestjs/graphql"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { Create{{Singular}}Command } from "../../application/create-{{singular}}.command"
import { toCreate{{Singular}}Type } from "./create-{{singular}}.mapper"
import { Create{{Singular}}Type } from "./dto/create-{{singular}}.type"

@Resolver()
/** GraphQL door of create-{{singular}}: a new {{singular}} row owned by the caller. */
export class Create{{Singular}}Resolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates one {{singular}} row for the caller. */
    @Mutation(() => Create{{Singular}}Type, { name: "create{{Singular}}" })
    async create{{Singular}}(@CurrentPrincipal() principal: Principal): Promise<Create{{Singular}}Type> {
        const result = await this.commandBus.execute(new Create{{Singular}}Command({ request: {}, principal }))
        return toCreate{{Singular}}Type(result)
    }
}
