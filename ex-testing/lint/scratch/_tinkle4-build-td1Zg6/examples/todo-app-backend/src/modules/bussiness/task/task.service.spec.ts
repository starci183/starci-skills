import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    TaskEntity 
} from "@modules/platform/databases/postgresql/primary/entities/task.entity"
import {
    createFakeEntityManager 
} from "@modules/platform/databases/postgresql/primary/testing/fake-entity-manager"
import {
    CompletionAuthorityRegistry 
} from "./completion-authority.providers"
import {
    TaskService 
} from "./task.service"

describe("TaskService",
    () => {
        let moduleRef: TestingModule
        let service: TaskService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    TaskService,
                    CompletionAuthorityRegistry,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<TaskEntity>("id"),
                    },
                ],
            }).compile()
            service = moduleRef.get(TaskService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("br.task.single-owner rev 2, default seam: with no authority registered the owner may complete and delete, and a stranger is refused on both",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")

                await expect(service.complete(record.id,
                    "owner-2")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
                await expect(service.delete(record.id,
                    "owner-2")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
                expect((await service.findById(record.id)).complete).toBe(false)

                const completed = await service.complete(record.id,
                    "owner-1")
                expect(completed.complete).toBe(true)
                const deleted = await service.delete(record.id,
                    "owner-1")
                expect(deleted.id).toBe(record.id)
            })

        it("br.task.delete.final: deleting a task removes it; there is no recovery path",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")

                await service.delete(record.id,
                    "owner-1")

                await expect(service.findById(record.id)).rejects.toMatchObject({
                    code: "TASK_NOT_FOUND_EXCEPTION" 
                })
            })

        it("ac.task.title.required.refuses-empty: a creation request with an empty or whitespace title is refused",
            async () => {
                await expect(service.create("owner-1",
                    "   ")).rejects.toMatchObject({
                    code: "TASK_TITLE_REQUIRED_EXCEPTION" 
                })
            })

        it("sds.task.completion-state.t-complete: completing an open task sets complete and a completedAt",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")

                const completed = await service.complete(record.id,
                    "owner-1")

                expect(completed.complete).toBe(true)
                expect(completed.completedAt).toBeInstanceOf(Date)
            })

        it("sds.task.completion-state.t-complete-again: completing a complete task writes nothing and leaves completedAt",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")
                const first = await service.complete(record.id,
                    "owner-1")

                const again = await service.complete(record.id,
                    "owner-1")
                const stored = await service.findById(record.id)

                expect(again.complete).toBe(true)
                expect(stored.completedAt).toEqual(first.completedAt)
            })

        it("sds.task.completion-state.t-reopen: reopening a completed task clears complete and completedAt",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")
                await service.complete(record.id,
                    "owner-1")

                const reopened = await service.reopen(record.id,
                    "owner-1")

                expect(reopened.complete).toBe(false)
                expect(reopened.completedAt).toBeNull()
            })
    })
