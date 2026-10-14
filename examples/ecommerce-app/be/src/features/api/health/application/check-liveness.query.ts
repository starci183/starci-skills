import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { LivenessReport } from "@modules/platform/probes"
import type { CheckLivenessRequest } from "./check-liveness.contracts"

/** Asks whether the process is alive without checking dependencies. */
export class CheckLivenessQuery extends Query<LivenessReport> {
    constructor(readonly params: PublicExecuteParams<CheckLivenessRequest>) {
        super()
    }
}
