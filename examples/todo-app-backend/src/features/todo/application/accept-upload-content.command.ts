import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { AcceptUploadContentRequest, AcceptUploadContentResult } from "./accept-upload-content.contracts"

/** Asks to store the bytes of an upload intent; the presigned token is the credential, so there is no principal. */
export class AcceptUploadContentCommand extends Command<AcceptUploadContentResult> {
    constructor(readonly params: PublicExecuteParams<AcceptUploadContentRequest>) {
        super()
    }
}
