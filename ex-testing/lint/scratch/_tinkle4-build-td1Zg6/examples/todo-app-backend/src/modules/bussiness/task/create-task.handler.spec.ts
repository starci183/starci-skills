import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    PlatformEventBus 
} from "@modules/platform/events/event-bus.providers"
import {
    TaskCreatedEvent 
} from "@modules/platform/events/events.types"
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
    TaskCreationPolicy 
} from "./creation-policy.contracts"
import {
    TaskCreationPolicyRegistry 
} from "./creation-policy.providers"
import {
    CompletionAuthorityRegistry 
} from "./completion-authority.providers"
import {
    TaskService 
} from "./task.service"
import {
    CreateTaskCommand 
} from "./create-task.command"
import {
    CreateTaskHandler 
} from "./create-task.handler"

const compileModule = () =>
    Test.createTestingModule({
        providers: [
            CreateTaskHandler,
            TaskService,
            TaskCreationPolicyRegistry,
            CompletionAuthorityRegistry,
            PlatformEventBus,
            {
                provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                useValue: createFakeEntityManager<TaskEntity>("id"),
            },
        ],
    }).compile()

describe("CreateTaskHandler",
    () => {
        let moduleRef: TestingModule
        let taskService: TaskService
        let events: PlatformEventBus
        let handler: CreateTaskHandler

        beforeEach(async () => {
            moduleRef = await compileModule()
            taskService = moduleRef.get(TaskService)
            events = moduleRef.get(PlatformEventBus)
            handler = moduleRef.get(CreateTaskHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.task.create: the task is created, owned by the submitter, not complete",
            async () => {
                const result = await handler.execute(new CreateTaskCommand({
                    ownerId: "owner-1", title: "Write the report" 
                }))
                const stored = await taskService.findById(result.taskId)
                expect(stored.owner).toBe("owner-1")
                expect(stored.complete).toBe(false)
                expect(result.title).toBe("Write the report")
            })

        it("ac.task.title.required.refuses-empty: an empty or whitespace-only title is refused and nothing is written",
            async () => {
                await expect(handler.execute(new CreateTaskCommand({
                    ownerId: "owner-1", title: "   " 
                }))).rejects.toMatchObject({
                    code: "TASK_TITLE_REQUIRED_EXCEPTION",
                })
                expect(await taskService.listOwnedBy("owner-1")).toHaveLength(0)
            })

        it("event.task.created: publishes on the PlatformEventBus after the write succeeds",
            async () => {
                const received: Array<unknown> = []
                events.subscribe(event => received.push(event))

                const result = await handler.execute(new CreateTaskCommand({
                    ownerId: "owner-1", title: "Write the report" 
                }))

                expect(received).toHaveLength(1)
                const [published] = received as [TaskCreatedEvent]
                expect(published).toBeInstanceOf(TaskCreatedEvent)
                expect(published.taskId).toBe(result.taskId)
                expect(published.ownerId).toBe("owner-1")
                expect(published.sourceEventId).toEqual(expect.any(String))
            })
    })

class TaskCreationRefused extends Error {
    readonly code = "TASK_CREATION_REFUSED"

    constructor() {
        super("Creation refused by policy.")
    }
}

class RefusingPolicy extends TaskCreationPolicy {
    async assertMayCreate(): Promise<void> {
        throw new TaskCreationRefused()
    }
}

describe("TaskCreationPolicyRegistry (sds.plan.cap-guard seam)",
    () => {
        let moduleRef: TestingModule

        afterEach(async () => {
            await moduleRef.close()
        })

        it("sds.plan.cap-guard: a registered policy can refuse creation before the write, and nothing is written",
            async () => {
                moduleRef = await compileModule()
                moduleRef.get(TaskCreationPolicyRegistry).register(new RefusingPolicy())
                const taskService = moduleRef.get(TaskService)
                const handler = moduleRef.get(CreateTaskHandler)

                await expect(handler.execute(new CreateTaskCommand({
                    ownerId: "owner-1", title: "Blocked" 
                }))).rejects.toMatchObject({
                    code: "TASK_CREATION_REFUSED",
                })
                expect(await taskService.listOwnedBy("owner-1")).toHaveLength(0)
            })

        it("an empty registry (the default) blocks nothing",
            async () => {
                moduleRef = await compileModule()
                const handler = moduleRef.get(CreateTaskHandler)

                const result = await handler.execute(new CreateTaskCommand({
                    ownerId: "owner-1", title: "Allowed" 
                }))

                expect(result.title).toBe("Allowed")
            })
    })
