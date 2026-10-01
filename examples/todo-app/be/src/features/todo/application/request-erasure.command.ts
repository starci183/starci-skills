import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestErasureRequest, RequestErasureResult } from "./request-erasure.contracts"

/** Asks to erase everything that identifies the caller from the audit log. */
export class RequestErasureCommand extends Command<RequestErasureResult> {
    constructor(readonly params: ExecuteParams<RequestErasureRequest>) {
        super()
    }
}
