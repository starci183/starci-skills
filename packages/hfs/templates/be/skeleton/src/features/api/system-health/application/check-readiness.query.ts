import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ReadinessReport } from "@modules/platform/http-security"
import type { CheckReadinessRequest } from "./check-readiness.contracts"

/** Asks whether the required primary database can serve requests. */
export class CheckReadinessQuery extends Query<ReadinessReport> {
    constructor(readonly params: PublicExecuteParams<CheckReadinessRequest>) {
        super()
    }
}
