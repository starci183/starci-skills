import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAccountRequest, GetAccountResult } from "./get-account.contracts"

/** Asks for the caller own account. */
export class GetAccountQuery extends Query<GetAccountResult> {
    constructor(readonly params: ExecuteParams<GetAccountRequest>) {
        super()
    }
}
