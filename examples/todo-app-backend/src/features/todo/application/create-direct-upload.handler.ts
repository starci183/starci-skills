import { CommandHandler } from "@nestjs/cqrs"
import { UploadService } from "@modules/domain/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateDirectUploadCommand } from "./create-direct-upload.command"
import type { CreateDirectUploadResult } from "./create-direct-upload.contracts"

@CommandHandler(CreateDirectUploadCommand)
/** Stores a file that arrived with the request; the caller session is the credential of this door. */
export class CreateDirectUploadHandler extends ICQRSHandler<CreateDirectUploadCommand, CreateDirectUploadResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(command: CreateDirectUploadCommand): Promise<CreateDirectUploadResult> {
        const { request, principal } = command.params
        return this.uploads.createDirect({
            ownerId: principal.id,
            filename: request.filename,
            mime: request.mime,
            content: request.content,
        })
    }
}
