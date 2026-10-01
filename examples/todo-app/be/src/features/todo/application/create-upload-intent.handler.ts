import { CommandHandler } from "@nestjs/cqrs"
import { UploadService } from "@modules/domain/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateUploadIntentCommand } from "./create-upload-intent.command"
import type { CreateUploadIntentResult } from "./create-upload-intent.contracts"

@CommandHandler(CreateUploadIntentCommand)
/** Opens a pending upload for the caller and answers the presigned request the client fulfils on the content door. */
export class CreateUploadIntentHandler extends ICQRSHandler<CreateUploadIntentCommand, CreateUploadIntentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(command: CreateUploadIntentCommand): Promise<CreateUploadIntentResult> {
        return this.uploads.createIntent({
            ownerId: command.params.principal.id,
            filename: command.params.request.filename,
            mime: command.params.request.mime,
            sizeBytes: command.params.request.sizeBytes,
        })
    }
}
