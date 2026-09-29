import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY,
} from "@modules/platform/databases/index"
import {
    TaskEntity,
} from "@modules/platform/databases/index"
import {
    createFakeEntityManager,
} from "@modules/platform/databases/index"
import {
    CompletionAuthorityRegistry 
} from "./completion-authority.providers"
import {
    TaskService 
} from "./task.service"
import {
    ListTasksQuery 
} from "./list-tasks.query"
import {
    ListTasksHandler 
} from "./list-tasks.handler"
import {
    Clock 
} from "@modules/platform/clock/index"
import {
    FakeClock 
} from "@starci/jest-preset/clock"
import {
    OwnershipGuard 
} from "./ownership.guard"

describe("ListTasksHandler",
    () => {
        let moduleRef: TestingModule
        let taskService: TaskService
        let handler: ListTasksHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    OwnershipGuard,
                    {
                        provide: Clock, useValue: new FakeClock() 
                    },
                    ListTasksHandler,
                    TaskService,
                    CompletionAuthorityRegistry,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<TaskEntity>("id"),
                    },
                ],
            }).compile()
            taskService = moduleRef.get(TaskService)
            handler = moduleRef.get(ListTasksHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.task.list.owned.excludes-others: every row belongs to the reader, no row of the other person appears",
            async () => {
                await taskService.create("owner-1",
                    "Owner one task")
                await taskService.create("owner-2",
                    "Owner two task")

                const result = await handler.execute(new ListTasksQuery({
                    ownerId: "owner-1" 
                }))

                expect(result.tasks).toHaveLength(1)
                expect(result.tasks[0].title).toBe("Owner one task")
            })
    })
