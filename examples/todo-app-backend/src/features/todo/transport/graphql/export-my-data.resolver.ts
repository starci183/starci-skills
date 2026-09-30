import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ExportMyDataQuery } from "../../application/export-my-data.query"
import { ExportMyDataType } from "./dto/export-my-data.type"
import { toExportMyDataType } from "./export-my-data.mapper"

@Resolver()
/** GraphQL door of exportMyData. */
export class ExportMyDataResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Every audit line naming the caller, decrypted; empty once a completed erasure destroyed the caller key. */
    @Query(() => [ExportMyDataType], {
        name: "exportMyData",
        description: "Every log line naming the caller, decrypted, or nothing once the caller's key has been erased.",
    })
    async exportMyData(@CurrentPrincipal() principal: Principal): Promise<Array<ExportMyDataType>> {
        const result = await this.queryBus.execute(new ExportMyDataQuery({ request: {}, principal }))
        return toExportMyDataType(result)
    }
}
