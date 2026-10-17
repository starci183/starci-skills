import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ReadinessReport } from "@modules/platform/probes"
import type { CheckReadinessRequest } from "./check-readiness.contracts"

/** Asks whether the app's required dependencies answer before the readiness deadline. */
export class CheckReadinessQuery extends Query<ReadinessReport> {
    constructor(readonly params: PublicExecuteParams<CheckReadinessRequest>) {
        super()
    }
}
