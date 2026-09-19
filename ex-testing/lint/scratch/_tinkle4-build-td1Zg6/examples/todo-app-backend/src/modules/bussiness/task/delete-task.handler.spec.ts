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
    PlatformEventBus 
} from "@modules/platform/events/event-bus.providers"
import {
    TaskDeletedEvent 
} from "@modules/platform/events/events.types"
import {
    CompletionAuthorityRegistry 
} from "./completion-authority.providers"
import {
    TaskService 
} from "./task.service"
import {
    DeleteTaskCommand 
} from "./delete-task.command"
import {
    DeleteTaskHandler 
} from "./delete-task.handler"

describe("DeleteTaskHandler",
    () => {
        let moduleRef: TestingModule
        let taskService: TaskService
        let events: PlatformEventBus
        let handler: DeleteTaskHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    DeleteTaskHandler,
                    TaskService,
                    CompletionAuthorityRegistry,
                    PlatformEventBus,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<TaskEntity>("id"),
                    },
                ],
            }).compile()
            taskService = moduleRef.get(TaskService)
            events = moduleRef.get(PlatformEventBus)
            handler = moduleRef.get(DeleteTaskHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.task.delete.final.stays-gone: the identifier resolves to nothing after deletion",
            async () => {
                const created = await taskService.create("owner-1",
                    "Ship it")

                const result = await handler.execute(new DeleteTaskCommand({
                    actorId: "owner-1", taskId: created.id 
                }))

                expect(result.deleted).toBe(true)
                await expect(taskService.findById(created.id)).rejects.toMatchObject({
                    code: "TASK_NOT_FOUND_EXCEPTION" 
                })
                // The list a person reads (br.task.list.owned) must agree: the row is gone from the store of
                // record, not merely hidden from one read path.
                expect(await taskService.listOwnedBy("owner-1")).toHaveLength(0)
            })

        it("ac.task.single-owner.refuses-stranger: a stranger cannot delete somebody else's task",
            async () => {
                const created = await taskService.create("owner-1",
                    "Ship it")

                await expect(handler.execute(new DeleteTaskCommand({
                    actorId: "owner-2", taskId: created.id 
                }))).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION",
                })
                expect(await taskService.findById(created.id)).toBeDefined()
            })

        it("event.task.deleted: publishes on the PlatformEventBus after the row is gone",
            async () => {
                const created = await taskService.create("owner-1",
                    "Ship it")
                const received: Array<unknown> = []
                events.subscribe(event => received.push(event))

                await handler.execute(new DeleteTaskCommand({
                    actorId: "owner-1", taskId: created.id 
                }))

                expect(received).toHaveLength(1)
                const [published] = received as [TaskDeletedEvent]
                expect(published).toBeInstanceOf(TaskDeletedEvent)
                expect(published.taskId).toBe(created.id)
                expect(published.ownerId).toBe("owner-1")
                expect(published.deletedAt).toBeInstanceOf(Date)
                expect(published.sourceEventId).toEqual(expect.any(String))
                expect(published.sourceEventId.length).toBeGreaterThan(0)
            })
    })
