import { QueryHandler } from "@nestjs/cqrs"
import { UploadErrorCode, UploadService } from "@modules/domain/upload"
import { InjectUploadStorage } from "@modules/integrations/upload"
import type { UploadStorage } from "@modules/integrations/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { ReadUploadContentResult } from "./read-upload-content.contracts"
import { ReadUploadContentQuery } from "./read-upload-content.query"
import { toStorageRefusal } from "./support/upload-storage-refusal.mapper"

@QueryHandler(ReadUploadContentQuery)
/**
 * Reads the bytes of a ready upload for its owner. A ready row whose object vanished from storage answers not found:
 * metadata without bytes is not downloadable, and the refusal has the shape a never-existing id gets.
 */
export class ReadUploadContentHandler extends ICQRSHandler<ReadUploadContentQuery, ReadUploadContentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectUploadStorage() private readonly storage: UploadStorage,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(query: ReadUploadContentQuery): Promise<ReadUploadContentResult> {
        const { request, principal } = query.params
        const authorized = await this.uploads.authorize({ uploadId: request.uploadId, actorId: principal.id })
        if (authorized.kind === "refused") return authorized
        const ready = this.uploads.requireReady(authorized.value)
        if (ready.kind === "refused") return ready
        const uploadId = ready.value.id
        let content: Buffer | null
        try {
            content = await this.storage.get({ uploadId })
        } catch (error) {
            const refusal = toStorageRefusal(error, uploadId)
            if (refusal) return refusal
            throw error
        }
        if (content === null) return refused(UploadErrorCode.NotFound, { uploadId, reason: "object-missing" })
        return ok({ filename: ready.value.filename, mime: ready.value.mime, content })
    }
}
