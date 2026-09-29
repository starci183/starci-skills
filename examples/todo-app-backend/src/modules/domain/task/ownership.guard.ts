import {
    Injectable
} from "@nestjs/common"
import {
    TaskRecord 
} from "./types/task-record"
import {
    TaskForbiddenException,
} from "./errors/task-forbidden"


/**
 * sds.task.ownership-guard: every mutation names the actor and compares it with the row's owner before
 * writing. Method names mirror the guard's two transitions (t-owner, t-stranger) from the record.
 */
@Injectable()
/** Refuses a mutation whose actor is not the task's owner; provided by the task module so the service receives it rather than building it. */
export class OwnershipGuard {
    assert(record: TaskRecord, actorId: string): void {
        if (record.owner === actorId) {
            this.tOwner()
            return
        }
        this.tStranger()
    }

    private tOwner(): void {
    // The write proceeds; there is nothing further to record when the actor matches the owner.
    }

    private tStranger(): never {
        throw new TaskForbiddenException({
        })
    }
}
