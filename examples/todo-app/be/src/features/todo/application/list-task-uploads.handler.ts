import { QueryHandler } from "@nestjs/cqrs"
import { UploadService } from "@modules/domain/upload"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListTaskUploadsQuery } from "./list-task-uploads.query"
import type { ListTaskUploadsResult } from "./list-task-uploads.contracts"

@QueryHandler(ListTaskUploadsQuery)
/** Lists the uploads attached to a task, for the owner of the task only. */
export class ListTaskUploadsHandler extends ICQRSHandler<ListTaskUploadsQuery, ListTaskUploadsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly uploads: UploadService,
    ) {
        super(logger)
    }

    protected override async process(query: ListTaskUploadsQuery): Promise<ListTaskUploadsResult> {
        return this.uploads.listForTask({ actorId: query.params.principal.id, taskId: query.params.request.taskId })
    }
}
