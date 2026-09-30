import { CommandHandler } from "@nestjs/cqrs"
import type { CommandBus } from "@nestjs/cqrs"
import { UploadService } from "@modules/domain/upload"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { EntityManager } from "typeorm"
import { AcceptUploadContentCommand } from "./accept-upload-content.command"
import { CreateDirectUploadCommand } from "./create-direct-upload.command"
import type { CreateDirectUploadResult } from "./create-direct-upload.contracts"

@CommandHandler(CreateDirectUploadCommand)
/**
 * Stores a file that arrived with the request: the pending row is written in a transaction with the received size, and
 * the storing, the inspection and the ready flip are the whole operation AcceptUploadContent already is, so this handler
 * dispatches it with a token it just minted instead of repeating it. The caller session is the credential of this door.
 */
export class CreateDirectUploadHandler extends ICQRSHandler<CreateDirectUploadCommand, CreateDirectUploadResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectCommandBus() private readonly commandBus: CommandBus,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(command: CreateDirectUploadCommand): Promise<CreateDirectUploadResult> {
        const { request, principal } = command.params
        const at = this.clock.now()
        const created = await this.entityManager.transaction((manager) =>
            this.uploads.createPending({
                manager,
                ownerId: principal.id,
                filename: request.filename,
                mime: request.mime,
                sizeBytes: request.content.length,
                at,
            }),
        )
        if (created.kind === "refused") return created
        const uploadId = created.value.id
        const { token } = this.uploads.presign({ uploadId, at })
        return this.commandBus.execute(
            new AcceptUploadContentCommand({ request: { uploadId, token, content: request.content } }),
        )
    }
}
