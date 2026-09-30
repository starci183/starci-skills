import { QueryHandler } from "@nestjs/cqrs"
import { UploadService } from "@modules/domain/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadUploadContentQuery } from "./read-upload-content.query"
import type { ReadUploadContentResult } from "./read-upload-content.contracts"

@QueryHandler(ReadUploadContentQuery)
/** Reads the bytes of a ready upload for its owner. */
export class ReadUploadContentHandler extends ICQRSHandler<ReadUploadContentQuery, ReadUploadContentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(query: ReadUploadContentQuery): Promise<ReadUploadContentResult> {
        return this.uploads.readContent({ actorId: query.params.principal.id, uploadId: query.params.request.uploadId })
    }
}
