import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadUploadContentRequest, ReadUploadContentResult } from "./read-upload-content.contracts"

/** Asks for the bytes of an upload of the caller. */
export class ReadUploadContentQuery extends Query<ReadUploadContentResult> {
    constructor(readonly params: ExecuteParams<ReadUploadContentRequest>) {
        super()
    }
}
