import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GetToolStatusRequest, GetToolStatusResult } from "./get-tool-status.contracts"

/** Asks for process-local status after the tool credential has authenticated the request. */
export class GetToolStatusQuery extends Query<GetToolStatusResult> {
    constructor(readonly params: PublicExecuteParams<GetToolStatusRequest>) {
        super()
    }
}
