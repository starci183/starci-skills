import { CommandHandler } from "@nestjs/cqrs"
import { UploadService } from "@modules/domain/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AcceptUploadContentCommand } from "./accept-upload-content.command"
import type { AcceptUploadContentResult } from "./accept-upload-content.contracts"

@CommandHandler(AcceptUploadContentCommand)
/**
 * The presigned data plane: stores the bytes of a pending upload when its token verifies; the row turns ready only after
 * the bytes were stored and inspected. A rejected inspection leaves the row pending.
 */
export class AcceptUploadContentHandler extends ICQRSHandler<AcceptUploadContentCommand, AcceptUploadContentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(command: AcceptUploadContentCommand): Promise<AcceptUploadContentResult> {
        return this.uploads.acceptContent({
            uploadId: command.params.request.uploadId,
            token: command.params.request.token,
            content: command.params.request.content,
        })
    }
}
