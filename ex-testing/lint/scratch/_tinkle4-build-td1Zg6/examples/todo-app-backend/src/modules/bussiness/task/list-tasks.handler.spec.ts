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
    ListTasksQuery 
} from "./list-tasks.query"
import {
    ListTasksHandler 
} from "./list-tasks.handler"

describe("ListTasksHandler",
    () => {
        let moduleRef: TestingModule
        let taskService: TaskService
        let handler: ListTasksHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
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
