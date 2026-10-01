import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteUploadRequest, DeleteUploadResult } from "./delete-upload.contracts"

/** Asks to delete an upload of the caller, its row and its stored bytes. */
export class DeleteUploadCommand extends Command<DeleteUploadResult> {
    constructor(readonly params: ExecuteParams<DeleteUploadRequest>) {
        super()
    }
}
