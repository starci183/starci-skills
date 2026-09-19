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
    TaskCompletedEvent 
} from "@modules/platform/events/events.types"
import {
    CompletionAuthorityRegistry 
} from "./completion-authority.providers"
import {
    TaskService 
} from "./task.service"
import {
    CompleteTaskCommand 
} from "./complete-task.command"
import {
    CompleteTaskHandler 
} from "./complete-task.handler"

describe("CompleteTaskHandler",
    () => {
        let moduleRef: TestingModule
        let taskService: TaskService
        let events: PlatformEventBus
        let handler: CompleteTaskHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    CompleteTaskHandler,
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
            handler = moduleRef.get(CompleteTaskHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.task.complete.once.is-idempotent: completing an already-complete task is unchanged and succeeds again",
            async () => {
                const created = await taskService.create("owner-1",
                    "Ship it")
                const first = await handler.execute(new CompleteTaskCommand({
                    actorId: "owner-1", taskId: created.id 
                }))
                const afterFirst = await taskService.findById(created.id)
                const second = await handler.execute(new CompleteTaskCommand({
                    actorId: "owner-1", taskId: created.id 
                }))
                expect(first.complete).toBe(true)
                expect(second.complete).toBe(true)
                const stored = await taskService.findById(created.id)
                expect(stored.completedAt).not.toBeNull()
                expect(stored.completedAt).toEqual(afterFirst.completedAt)
                expect(stored.title).toBe(afterFirst.title)
                expect(stored.owner).toBe(afterFirst.owner)
            })

        it("ac.task.single-owner.refuses-stranger: a stranger cannot complete somebody else's task",
            async () => {
                const created = await taskService.create("owner-1",
                    "Ship it")
                await expect(handler.execute(new CompleteTaskCommand({
                    actorId: "owner-2", taskId: created.id 
                }))).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION",
                })
                expect((await taskService.findById(created.id)).complete).toBe(false)
            })

        it("event.task.completed: publishes on the PlatformEventBus after the write succeeds",
            async () => {
                const created = await taskService.create("owner-1",
                    "Ship it")
                const received: Array<unknown> = []
                events.subscribe(event => received.push(event))

                await handler.execute(new CompleteTaskCommand({
                    actorId: "owner-1", taskId: created.id 
                }))

                expect(received).toHaveLength(1)
                const [published] = received as [TaskCompletedEvent]
                expect(published).toBeInstanceOf(TaskCompletedEvent)
                expect(published.taskId).toBe(created.id)
                expect(published.ownerId).toBe("owner-1")
                expect(published.completedAt).toBeInstanceOf(Date)
                expect(published.sourceEventId).toEqual(expect.any(String))
                expect(published.sourceEventId.length).toBeGreaterThan(0)
            })
    })
