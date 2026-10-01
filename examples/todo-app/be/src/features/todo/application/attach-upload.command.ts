import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AttachUploadRequest, AttachUploadResult } from "./attach-upload.contracts"

/** Asks to point a ready upload of the caller at a task of the caller. */
export class AttachUploadCommand extends Command<AttachUploadResult> {
    constructor(readonly params: ExecuteParams<AttachUploadRequest>) {
        super()
    }
}
