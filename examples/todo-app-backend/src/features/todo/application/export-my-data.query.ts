import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ExportMyDataRequest, ExportMyDataResult } from "./export-my-data.contracts"

/** Asks for every audit line that names the caller. */
export class ExportMyDataQuery extends Query<ExportMyDataResult> {
    constructor(readonly params: ExecuteParams<ExportMyDataRequest>) {
        super()
    }
}
