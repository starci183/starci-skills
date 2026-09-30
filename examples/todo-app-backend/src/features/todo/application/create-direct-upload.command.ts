import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateDirectUploadRequest, CreateDirectUploadResult } from "./create-direct-upload.contracts"

/** Asks to store the bytes of a file that arrived with the request itself, for the caller. */
export class CreateDirectUploadCommand extends Command<CreateDirectUploadResult> {
    constructor(readonly params: ExecuteParams<CreateDirectUploadRequest>) {
        super()
    }
}
