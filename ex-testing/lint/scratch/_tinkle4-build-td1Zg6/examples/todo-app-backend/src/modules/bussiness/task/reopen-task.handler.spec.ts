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
import {
    ReopenTaskCommand 
} from "./reopen-task.command"
import {
    ReopenTaskHandler 
} from "./reopen-task.handler"

describe("ReopenTaskHandler",
    () => {
        let moduleRef: TestingModule
        let taskService: TaskService
        let handler: ReopenTaskHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    ReopenTaskHandler,
                    TaskService,
                    CompletionAuthorityRegistry,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<TaskEntity>("id"),
                    },
                ],
            }).compile()
            taskService = moduleRef.get(TaskService)
            handler = moduleRef.get(ReopenTaskHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.task.complete.once.is-reversible: the task reads incomplete and its completion timestamp is cleared",
            async () => {
                const created = await taskService.create("owner-1",
                    "Ship it")
                await taskService.complete(created.id,
                    "owner-1")

                const result = await handler.execute(new ReopenTaskCommand({
                    actorId: "owner-1", taskId: created.id 
                }))

                expect(result.complete).toBe(false)
                expect((await taskService.findById(created.id)).completedAt).toBeNull()
            })

        it("ac.task.single-owner.refuses-stranger: a stranger cannot reopen somebody else's task",
            async () => {
                const created = await taskService.create("owner-1",
                    "Ship it")
                await taskService.complete(created.id,
                    "owner-1")

                await expect(handler.execute(new ReopenTaskCommand({
                    actorId: "owner-2", taskId: created.id 
                }))).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION",
                })
            })
    })
