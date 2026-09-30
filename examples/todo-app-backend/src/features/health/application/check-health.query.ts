import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { CheckHealthRequest, CheckHealthResult } from "./check-health.contracts"

/** Asks whether the service and its dependencies answer. */
export class CheckHealthQuery extends Query<CheckHealthResult> {
    constructor(readonly params: PublicExecuteParams<CheckHealthRequest>) {
        super()
    }
}
