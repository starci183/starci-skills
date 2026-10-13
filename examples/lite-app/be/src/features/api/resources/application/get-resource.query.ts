import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetResourceRequest, GetResourceResult } from "./get-resource.contracts"

/** Asks for one resource row the authenticated caller owns. */
export class GetResourceQuery extends Query<GetResourceResult> {
    constructor(readonly params: ExecuteParams<GetResourceRequest>) {
        super()
    }
}
