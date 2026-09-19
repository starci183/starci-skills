import {
    TaskRecord 
} from "./types/task-record"
import {
    TaskForbiddenException 
} from "@modules/shared/exceptions/errors/task/task-forbidden"


/**
 * sds.task.ownership-guard: every mutation names the actor and compares it with the row's owner before
 * writing. Method names mirror the guard's two transitions (t-owner, t-stranger) from the record.
 */
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
