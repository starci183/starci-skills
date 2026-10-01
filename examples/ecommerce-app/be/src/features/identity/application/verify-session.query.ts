import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { VerifySessionRequest, VerifySessionResult } from "./verify-session.contracts"

/** Asks which person a bearer token belongs to; the order service calls it for every authenticated request. */
export class VerifySessionQuery extends Query<VerifySessionResult> {
    constructor(readonly params: PublicExecuteParams<VerifySessionRequest>) {
        super()
    }
}
