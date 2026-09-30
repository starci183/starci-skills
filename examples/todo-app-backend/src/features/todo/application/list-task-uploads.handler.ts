import { QueryHandler } from "@nestjs/cqrs"
import { TaskService } from "@modules/domain/task"
import { UploadErrorCode, UploadService } from "@modules/domain/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { ListTaskUploadsResult } from "./list-task-uploads.contracts"
import { ListTaskUploadsQuery } from "./list-task-uploads.query"
import { toUploadSummary } from "./support/upload-summary.mapper"

@QueryHandler(ListTaskUploadsQuery)
/**
 * Lists the uploads attached to a task, for the owner of the task only: the task ownership decision precedes the
 * listing, so a stranger learns nothing about the attachments, and the read itself is bound to the owner.
 */
export class ListTaskUploadsHandler extends ICQRSHandler<ListTaskUploadsQuery, ListTaskUploadsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly uploads: UploadService,
        private readonly tasks: TaskService,
    ) {
        super(logger)
    }

    protected override async process(query: ListTaskUploadsQuery): Promise<ListTaskUploadsResult> {
        const { request, principal } = query.params
        const task = await this.tasks.find({ id: request.taskId })
        if (!task) return refused(UploadErrorCode.NotFound, { taskId: request.taskId })
        if (task.owner !== principal.id) return refused(UploadErrorCode.Forbidden, { taskId: task.id })
        const listed = await this.uploads.listForTask({ taskId: task.id, ownerId: principal.id })
        return ok({ uploads: listed.map(toUploadSummary) })
    }
}
