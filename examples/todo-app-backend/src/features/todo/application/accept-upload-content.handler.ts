import { CommandHandler } from "@nestjs/cqrs"
import { UploadErrorCode, UploadService } from "@modules/domain/upload"
import { InjectUploadStorage } from "@modules/integrations/upload"
import type { ScanVerdict, UploadStorage } from "@modules/integrations/upload"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { AcceptUploadContentCommand } from "./accept-upload-content.command"
import type { AcceptUploadContentResult } from "./accept-upload-content.contracts"
import { toStorageRefusal } from "./support/upload-storage-refusal.mapper"
import { toUploadSummary } from "./support/upload-summary.mapper"

@CommandHandler(AcceptUploadContentCommand)
/**
 * The presigned data plane: stores the bytes of a pending upload when its token verifies. The token, the pending state
 * and the RECEIVED size are decided first; the bytes are stored and inspected outside any transaction; only then does
 * the row turn ready. A rejected inspection deletes the bytes and leaves the row pending.
 */
export class AcceptUploadContentHandler extends ICQRSHandler<AcceptUploadContentCommand, AcceptUploadContentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectUploadStorage() private readonly storage: UploadStorage,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(command: AcceptUploadContentCommand): Promise<AcceptUploadContentResult> {
        const { uploadId, token, content } = command.params.request
        const at = this.clock.now()
        const admitted = await this.uploads.admitContent({ uploadId, token, sizeBytes: content.length, at })
        if (admitted.kind === "refused") return admitted
        let verdict: ScanVerdict
        try {
            verdict = await this.storage.store({ uploadId, content })
        } catch (error) {
            const refusal = toStorageRefusal(error, uploadId)
            if (refusal) return refusal
            throw error
        }
        if (!verdict.accepted) return refused(UploadErrorCode.ScanRejected, { uploadId, reason: verdict.reason })
        const ready = await this.entityManager.transaction((manager) =>
            this.uploads.markReady({ manager, upload: admitted.value, sizeBytes: content.length }),
        )
        return ok(toUploadSummary(ready))
    }
}
