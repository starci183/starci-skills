import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { DatabaseReadinessReport } from "@modules/platform/database"
import type { CheckReadinessRequest } from "./check-readiness.contracts"

/** Asks whether the required primary dependency can serve requests. */
export class CheckReadinessQuery extends Query<DatabaseReadinessReport> {
    constructor(readonly params: PublicExecuteParams<CheckReadinessRequest>) {
        super()
    }
}
