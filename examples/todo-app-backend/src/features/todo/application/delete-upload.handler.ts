import { CommandHandler } from "@nestjs/cqrs"
import { UploadService } from "@modules/domain/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteUploadCommand } from "./delete-upload.command"
import type { DeleteUploadResult } from "./delete-upload.contracts"

@CommandHandler(DeleteUploadCommand)
/** Deletes an upload of the caller; the stored bytes go first, so an object never outlives its metadata. */
export class DeleteUploadHandler extends ICQRSHandler<DeleteUploadCommand, DeleteUploadResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(command: DeleteUploadCommand): Promise<DeleteUploadResult> {
        const { request, principal } = command.params
        return this.uploads.remove({ actorId: principal.id, uploadId: request.uploadId })
    }
}
