import { Query } from "@nestjs/cqrs"
import type { LivenessReport } from "@modules/domain/liveness"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { CheckLivenessRequest } from "./check-liveness.contracts"

/** Asks whether this process is alive. */
export class CheckLivenessQuery extends Query<LivenessReport> {
    constructor(readonly params: PublicExecuteParams<CheckLivenessRequest>) {
        super()
    }
}
