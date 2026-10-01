import { CommandHandler } from "@nestjs/cqrs"
import { UploadService } from "@modules/domain/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AttachUploadCommand } from "./attach-upload.command"
import type { AttachUploadResult } from "./attach-upload.contracts"

@CommandHandler(AttachUploadCommand)
/** Attaches a ready upload of the caller to a task of the caller. Attaching is metadata only: the bytes never move. */
export class AttachUploadHandler extends ICQRSHandler<AttachUploadCommand, AttachUploadResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(command: AttachUploadCommand): Promise<AttachUploadResult> {
        return this.uploads.attach({
            actorId: command.params.principal.id,
            uploadId: command.params.request.uploadId,
            taskId: command.params.request.taskId,
        })
    }
}
