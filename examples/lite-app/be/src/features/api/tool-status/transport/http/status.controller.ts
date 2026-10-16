import { Controller, Get, Param } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Credential } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { GetToolStatusResult } from "../../application/get-tool-status.contracts"
import { GetToolStatusQuery } from "../../application/get-tool-status.query"

@Controller("tools")
/** Reports process-local status to a caller authenticated by its tool token. */
export class StatusController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reports status after the global guards authenticate the tool token for this id. */
    @Get("status/:id")
    @Credential({ kind: "tool-token" })
    status(@Param("id") id: string): Promise<GetToolStatusResult> {
        return this.queryBus.execute(new GetToolStatusQuery({ request: { id } }))
    }
}
