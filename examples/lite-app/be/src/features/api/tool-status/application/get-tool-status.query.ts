import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GetToolStatusRequest } from "./get-tool-status.contracts"
import type { LivenessReport } from "@modules/domain/liveness"

/** Asks for process-local status after the tool credential has authenticated the request. */
export class GetToolStatusQuery extends Query<LivenessReport> {
    constructor(readonly params: PublicExecuteParams<GetToolStatusRequest>) {
        super()
    }
}
