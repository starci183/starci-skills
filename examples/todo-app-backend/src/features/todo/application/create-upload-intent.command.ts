import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateUploadIntentRequest, CreateUploadIntentResult } from "./create-upload-intent.contracts"

/** Asks to open an upload intent owned by the caller. */
export class CreateUploadIntentCommand extends Command<CreateUploadIntentResult> {
    constructor(readonly params: ExecuteParams<CreateUploadIntentRequest>) {
        super()
    }
}
