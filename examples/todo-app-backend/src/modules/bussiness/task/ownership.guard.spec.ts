import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    TaskForbiddenException 
} from "@modules/shared/exceptions/errors/task/task-forbidden"

import {
    OwnershipGuard 
} from "./ownership.guard"
import {
    TaskRecord 
} from "./types/task-record"

/**
 * sds.task.ownership-guard in isolation: delete's sole, unconditional authority (task.service.ts holds
 * it as a private field, never through the replaceable CompletionAuthority seam). Resolved through a
 * TestingModule like every other spec in this lane; the class has no dependencies to bind.
 */
describe("OwnershipGuard (sds.task.ownership-guard)",
    () => {
        let moduleRef: TestingModule
        let guard: OwnershipGuard

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [OwnershipGuard] 
            }).compile()
            guard = moduleRef.get(OwnershipGuard)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        const record = (owner: string): TaskRecord => ({
            owner 
        }) as TaskRecord

        it("t-owner: the owner passes the assertion",
            () => {
                expect(() => guard.assert(record("owner-1"),
                    "owner-1")).not.toThrow()
            })

        it("t-stranger: a non-owner is refused with the stable TASK_FORBIDDEN code",
            () => {
                expect(() => guard.assert(record("owner-1"),
                    "someone-else")).toThrow(TaskForbiddenException)
                expect(() => guard.assert(record("owner-1"),
                    "someone-else")).toThrow(
                    expect.objectContaining({
                        code: "TASK_FORBIDDEN_EXCEPTION" 
                    }),
                )
            })

        it("no widened role exists on this seam: even a collaborator-shaped actor id is refused",
            () => {
                expect(() => guard.assert(record("owner-1"),
                    "editor-1")).toThrow(TaskForbiddenException)
            })
    })
