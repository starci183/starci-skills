import { CommandHandler } from "@nestjs/cqrs"
import { UploadService } from "@modules/domain/upload"
import { InjectUploadStorage } from "@modules/integrations/upload"
import type { UploadStorage } from "@modules/integrations/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { DeleteUploadCommand } from "./delete-upload.command"
import type { DeleteUploadResult } from "./delete-upload.contracts"
import { toStorageRefusal } from "./support/upload-storage-refusal.mapper"

@CommandHandler(DeleteUploadCommand)
/**
 * Deletes an upload of the caller. The stored bytes go first, outside any transaction, and a failure of the storage
 * refuses before the row goes, so a surviving object never outlives the metadata that names it.
 */
export class DeleteUploadHandler extends ICQRSHandler<DeleteUploadCommand, DeleteUploadResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectUploadStorage() private readonly storage: UploadStorage,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(command: DeleteUploadCommand): Promise<DeleteUploadResult> {
        const { request, principal } = command.params
        const authorized = await this.uploads.authorize({ uploadId: request.uploadId, actorId: principal.id })
        if (authorized.kind === "refused") return authorized
        const uploadId = authorized.value.id
        try {
            await this.storage.delete({ uploadId })
        } catch (error) {
            const refusal = toStorageRefusal(error, uploadId)
            if (refusal) return refusal
            throw error
        }
        await this.entityManager.transaction((manager) => this.uploads.remove({ manager, id: uploadId }))
        return ok({ uploadId, deleted: true })
    }
}
