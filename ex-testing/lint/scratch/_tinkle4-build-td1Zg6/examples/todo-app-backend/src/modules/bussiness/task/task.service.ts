import {
    Injectable 
} from "@nestjs/common"
import {
    randomUUID 
} from "node:crypto"
import type {
    EntityManager 
} from "typeorm"
import {
    InjectPrimaryEntityManager 
} from "@modules/platform/databases/postgresql/primary/primary.decorators"
import {
    TaskEntity 
} from "@modules/platform/databases/postgresql/primary/entities/task.entity"
import {
    OwnershipGuard 
} from "./ownership.guard"
import {
    CompletionAuthorityRegistry 
} from "./completion-authority.providers"
import {
    TaskRecord 
} from "./types/task-record"
import {
    TaskNotFoundException 
} from "@modules/shared/exceptions/errors/task/task-not-found"
import {
    TaskTitleRequiredException 
} from "@modules/shared/exceptions/errors/task/task-title-required"


/**
 * data.task.task: owner is bound at creation and never rewritten; completedAt is set if and only if
 * complete is true. Completion method names mirror sds.task.completion-state's transitions
 * (t-complete, t-complete-again, t-reopen) so a reader can hold the record beside the code. The row lives
 * in Postgres, through the platform database module's TaskEntity, reached the way nivo's own capability
 * services reach theirs: `@InjectPrimaryEntityManager()` and `entityManager.findOneBy(TaskEntity, ...)`,
 * never a per-entity `@InjectRepository` - the databases module owns persistence, this service owns
 * behaviour.
 *
 * br.task.single-owner rev 2: delete is checked against OwnershipGuard, unconditionally and always; who
 * may complete/reopen is checked against the CompletionAuthorityRegistry's current authority instead, so
 * a future `share` feature can widen that half alone without touching delete's guard.
 *
 * Renamed from the former `TaskRepository` (under `modules/domain/task`) to `TaskService` under
 * `modules/bussiness/task` - nivo's capability modules own persistence and business rules together in
 * one service, not a separate repository layer.
 */
@Injectable()
/** Injectable service owning the task logic the task capability exposes; wired by the capability's own module. */
export class TaskService {
    private readonly guard = new OwnershipGuard()

    constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    private readonly completionAuthorityRegistry: CompletionAuthorityRegistry = new CompletionAuthorityRegistry(),
    ) {}

    async create(owner: string, title: string): Promise<TaskRecord> {
        const trimmed = title.trim()
        if (!trimmed) {
            throw new TaskTitleRequiredException({
            })
        }
        const saved = await this.entityManager.save(TaskEntity,
            {
                id: randomUUID(),
                owner,
                title: trimmed,
                complete: false,
                completedAt: null,
            })
        return toRecord(saved)
    }

    async findById(id: string): Promise<TaskRecord> {
        const row = await this.entityManager.findOneBy(TaskEntity,
            {
                id 
            })
        if (!row) {
            throw new TaskNotFoundException({
                taskId: id 
            })
        }
        return toRecord(row)
    }

    async listOwnedBy(owner: string): Promise<Array<TaskRecord>> {
        const rows = await this.entityManager.findBy(TaskEntity,
            {
                owner 
            })
        return rows.map(toRecord)
    }

    async complete(id: string, actorId: string): Promise<TaskRecord> {
        const row = await this.findRowForCompletion(id,
            actorId,
            "complete")
        return this.tComplete(row)
    }

    async reopen(id: string, actorId: string): Promise<TaskRecord> {
        const row = await this.findRowForCompletion(id,
            actorId,
            "reopen")
        return this.tReopen(row)
    }

    async delete(id: string, actorId: string): Promise<TaskRecord> {
        const row = await this.findOwnedRow(id,
            actorId)
        await this.entityManager.delete(TaskEntity,
            row.id)
        return toRecord(row)
    }

    /** Delete's sole, unconditional authority: OwnershipGuard, never the replaceable CompletionAuthority. */
    private async findOwnedRow(id: string, actorId: string): Promise<TaskEntity> {
        const row = await this.entityManager.findOneBy(TaskEntity,
            {
                id 
            })
        if (!row) {
            throw new TaskNotFoundException({
                taskId: id 
            })
        }
        this.guard.assert(toRecord(row),
            actorId)
        return row
    }

    /** Complete/reopen's authority: whichever CompletionAuthority is currently registered. */
    private async findRowForCompletion(id: string, actorId: string, action: "complete" | "reopen"): Promise<TaskEntity> {
        const row = await this.entityManager.findOneBy(TaskEntity,
            {
                id 
            })
        if (!row) {
            throw new TaskNotFoundException({
                taskId: id 
            })
        }
        this.completionAuthorityRegistry.current().assertMayTransition(toRecord(row),
            actorId,
            action)
        return row
    }

    private async tComplete(row: TaskEntity): Promise<TaskRecord> {
        if (row.complete) {
            return this.tCompleteAgain(row)
        }
        row.complete = true
        row.completedAt = new Date()
        const saved = await this.entityManager.save(TaskEntity,
            row)
        return toRecord(saved)
    }

    private async tCompleteAgain(row: TaskEntity): Promise<TaskRecord> {
        return toRecord(row)
    }

    private async tReopen(row: TaskEntity): Promise<TaskRecord> {
        row.complete = false
        row.completedAt = null
        const saved = await this.entityManager.save(TaskEntity,
            row)
        return toRecord(saved)
    }
}

function toRecord(row: TaskEntity): TaskRecord {
    return new TaskRecord(row.id,
        row.owner,
        row.title,
        row.complete,
        row.completedAt)
}
