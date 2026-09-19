import {
    Injectable 
} from "@nestjs/common"
import {
    CommandHandler 
} from "@nestjs/cqrs"
import {
    AbstractCommandHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    randomUUID 
} from "node:crypto"
import {
    PlatformEventBus 
} from "@modules/platform/events/event-bus.providers"
import {
    TaskCompletedEvent 
} from "@modules/platform/events/events.types"
import {
    TaskService 
} from "./task.service"
import {
    CompleteTaskCommand, CompleteTaskCommandResult 
} from "./complete-task.command"

/**
 * fr.task.complete composes br.task.single-owner (a non-owner attempt is refused, via the
 * CompletionAuthority the service consults) and br.task.complete.once (completing an already-complete
 * task is unchanged and not an error). event.task.completed is published after the write succeeds,
 * including on the idempotent re-complete path.
 *
 * Ported from the former `CompleteTaskUseCase`; see create-task.handler.ts's comment for why this is now
 * a CQRS handler owned by `bussiness/task` rather than a `features/complete-task/application` use case.
 */
@Injectable()
@CommandHandler(CompleteTaskCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class CompleteTaskHandler extends AbstractCommandHandler<CompleteTaskCommand, CompleteTaskCommandResult> {
    constructor(
    private readonly taskService: TaskService,
    private readonly events: PlatformEventBus,
    ) {
        super()
    }

    protected override async process(command: CompleteTaskCommand): Promise<CompleteTaskCommandResult> {
        const { params } = command
        const record = await this.taskService.complete(params.taskId,
            params.actorId)
        this.events.publish(new TaskCompletedEvent(record.id,
            record.owner,
            record.completedAt ?? new Date(),
            randomUUID()))
        return {
            taskId: record.id, complete: record.complete 
        }
    }
}
