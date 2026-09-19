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
    TaskCreatedEvent 
} from "@modules/platform/events/events.types"
import {
    TaskService 
} from "./task.service"
import {
    TaskCreationPolicyRegistry 
} from "./creation-policy.providers"
import {
    CreateTaskCommand, CreateTaskCommandResult 
} from "./create-task.command"

/**
 * fr.task.create composes br.task.single-owner (the submitter owns the new task) and
 * br.task.title.required (an empty or whitespace-only title is refused and nothing is written). Before
 * writing, every policy registered in TaskCreationPolicyRegistry is consulted (empty by default, so
 * nothing blocks creation until a feature such as `plan` registers a capacity guard). After the write
 * succeeds, event.task.created is published on the PlatformEventBus.
 *
 * Ported from the former `CreateTaskUseCase` (under `features/create-task/application`) into a CQRS
 * command handler owned by the `bussiness/task` capability module, matching nivo's
 * `apply-paid-agent-workspace-plan-change.handler.ts` shape: the handler lives beside the service it
 * orchestrates, not in a separate feature/application folder.
 */
@Injectable()
@CommandHandler(CreateTaskCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class CreateTaskHandler extends AbstractCommandHandler<CreateTaskCommand, CreateTaskCommandResult> {
    constructor(
    private readonly creationPolicyRegistry: TaskCreationPolicyRegistry,
    private readonly taskService: TaskService,
    private readonly events: PlatformEventBus,
    ) {
        super()
    }

    protected override async process(command: CreateTaskCommand): Promise<CreateTaskCommandResult> {
        const { params } = command
        await this.creationPolicyRegistry.assertMayCreate({
            actorId: params.ownerId 
        },
        {
            title: params.title 
        })
        const record = await this.taskService.create(params.ownerId,
            params.title)
        this.events.publish(new TaskCreatedEvent(record.id,
            record.owner,
            new Date(),
            randomUUID()))
        return {
            taskId: record.id, title: record.title 
        }
    }
}
