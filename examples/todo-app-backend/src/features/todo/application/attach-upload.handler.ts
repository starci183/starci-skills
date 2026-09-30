import { CommandHandler } from "@nestjs/cqrs"
import { TaskService } from "@modules/domain/task"
import { UploadErrorCode, UploadService } from "@modules/domain/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { AttachUploadCommand } from "./attach-upload.command"
import type { AttachUploadResult } from "./attach-upload.contracts"
import { toUploadSummary } from "./support/upload-summary.mapper"

@CommandHandler(AttachUploadCommand)
/**
 * Attaches a ready upload of the caller to a task of the caller. The upload capability never reads a task, so the
 * ownership decision on the task is made here with the task service. Attaching is metadata only: the bytes never move.
 */
export class AttachUploadHandler extends ICQRSHandler<AttachUploadCommand, AttachUploadResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly uploads: UploadService,
        private readonly tasks: TaskService,
    ) {
        super(logger)
    }

    protected override async process(command: AttachUploadCommand): Promise<AttachUploadResult> {
        const { request, principal } = command.params
        const authorized = await this.uploads.authorize({ uploadId: request.uploadId, actorId: principal.id })
        if (authorized.kind === "refused") return authorized
        const ready = this.uploads.requireReady(authorized.value)
        if (ready.kind === "refused") return ready
        const task = await this.tasks.find({ id: request.taskId })
        if (!task) return refused(UploadErrorCode.NotFound, { taskId: request.taskId })
        if (task.owner !== principal.id) return refused(UploadErrorCode.Forbidden, { taskId: task.id })
        const attached = await this.entityManager.transaction((manager) =>
            this.uploads.attach({ manager, upload: ready.value, taskId: task.id }),
        )
        return ok(toUploadSummary(attached))
    }
}
