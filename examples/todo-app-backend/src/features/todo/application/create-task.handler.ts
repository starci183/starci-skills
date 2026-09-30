import { randomUUID } from "node:crypto"
import { CommandHandler } from "@nestjs/cqrs"
import { AuditAction, toAuditAppendMessage } from "@modules/domain/audit"
import { CapGuardPolicy } from "@modules/domain/plan"
import { TaskErrorCode, TaskService } from "@modules/domain/task"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { CreateTaskCommand } from "./create-task.command"
import type { CreateTaskResult } from "./create-task.contracts"

@CommandHandler(CreateTaskCommand)
/**
 * Creates a task for the caller unless the plan of the caller has no room for another active task; the row and the
 * audit message are written in one transaction, so the audit line exists exactly when the task does.
 */
export class CreateTaskHandler extends ICQRSHandler<CreateTaskCommand, CreateTaskResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        private readonly tasks: TaskService,
        private readonly capGuard: CapGuardPolicy,
    ) {
        super(logger)
    }

    protected override async process(command: CreateTaskCommand): Promise<CreateTaskResult> {
        const { request, principal } = command.params
        const at = this.clock.now()
        const owned = await this.tasks.listOwnedBy({ ownerId: principal.id })
        const verdict = await this.capGuard.check({
            personId: principal.id,
            activeTaskCount: owned.filter((task) => !task.complete).length,
        })
        if (!verdict.allowed) {
            return refused(TaskErrorCode.PlanCapExceeded, { cap: verdict.cap, upgradePath: verdict.upgradePath })
        }
        return this.entityManager.transaction(async (manager) => {
            const created = await this.tasks.create({ manager, ownerId: principal.id, title: request.title })
            if (created.kind === "refused") return created
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: principal.id,
                    action: AuditAction.TaskCreated,
                    target: created.value.id,
                    at,
                }),
            )
            return ok({ taskId: created.value.id, title: created.value.title })
        })
    }
}
