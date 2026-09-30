import { CommandHandler } from "@nestjs/cqrs"
import { UPLOAD_TOKEN_HEADER, UploadService } from "@modules/domain/upload"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { CreateUploadIntentCommand } from "./create-upload-intent.command"
import type { CreateUploadIntentResult } from "./create-upload-intent.contracts"

@CommandHandler(CreateUploadIntentCommand)
/**
 * Opens a pending upload for the caller after the declared media type and size pass the intake rules, and answers the
 * presigned request the client fulfils on the content door. Nothing is stored yet: the bytes come with the token.
 */
export class CreateUploadIntentHandler extends ICQRSHandler<CreateUploadIntentCommand, CreateUploadIntentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(command: CreateUploadIntentCommand): Promise<CreateUploadIntentResult> {
        const { request, principal } = command.params
        const at = this.clock.now()
        const created = await this.entityManager.transaction((manager) =>
            this.uploads.createPending({
                manager,
                ownerId: principal.id,
                filename: request.filename,
                mime: request.mime,
                sizeBytes: request.sizeBytes,
                at,
            }),
        )
        if (created.kind === "refused") return created
        const { token, expiresAt } = this.uploads.presign({ uploadId: created.value.id, at })
        return ok({
            uploadId: created.value.id,
            method: "PUT",
            url: `/uploads/${created.value.id}/content`,
            headers: [
                { name: UPLOAD_TOKEN_HEADER, value: token },
                { name: "content-type", value: created.value.mime },
            ],
            expiresAt,
        })
    }
}
