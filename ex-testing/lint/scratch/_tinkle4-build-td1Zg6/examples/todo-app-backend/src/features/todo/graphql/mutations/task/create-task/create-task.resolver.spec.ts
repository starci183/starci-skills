import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    SessionNotFoundException 
} from "@modules/shared/exceptions/errors/session/session-not-found"
import {
    SessionRecord 
} from "@modules/bussiness/session/types/session-record"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    CreateTaskCommand 
} from "@modules/bussiness/task/create-task.command"
import {
    TaskTitleRequiredException 
} from "@modules/shared/exceptions/errors/task/task-title-required"

import {
    CreateTaskInput 
} from "./graphql-types/input"
import {
    CreateTaskResolver 
} from "./create-task.resolver"

const req = {
    headers: {
        authorization: "Bearer token-1" 
    } 
}
const activeSession = new SessionRecord("token-1",
    "owner-1",
    new Date(),
    new Date(Date.now() + 60_000))

describe("CreateTaskResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: CreateTaskResolver
        let commandBus: { execute: jest.Mock }
        let sessionService: { findActive: jest.Mock }

        beforeEach(async () => {
            commandBus = {
                execute: jest.fn() 
            }
            sessionService = {
                findActive: jest.fn().mockResolvedValue(activeSession) 
            }
            moduleRef = await Test.createTestingModule({
                providers: [
                    CreateTaskResolver,
                    {
                        provide: CommandBus, useValue: commandBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(CreateTaskResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.task.create: resolves the caller from the bearer token, dispatches CreateTaskCommand and returns the created task",
            async () => {
                commandBus.execute.mockResolvedValue({
                    taskId: "task-1", title: "Write the report" 
                })
                const input: CreateTaskInput = {
                    title: "Write the report" 
                }

                const response = await resolver.createTask(req,
                    input)

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const command = commandBus.execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(CreateTaskCommand)
                expect(command.params).toEqual({
                    ownerId: "owner-1", title: "Write the report" 
                })
                expect(response.taskId).toBe("task-1")
                expect(response.title).toBe("Write the report")
            })

        it("refuses before dispatching any command when the session cannot be resolved",
            async () => {
                sessionService.findActive.mockRejectedValue(new SessionNotFoundException())

                await expect(resolver.createTask(req,
                    {
                        title: "Write the report" 
                    })).rejects.toMatchObject({
                    code: "SESSION_NOT_FOUND_EXCEPTION",
                })
                expect(commandBus.execute).not.toHaveBeenCalled()
            })

        it("passes an empty token to the session boundary when the Authorization header is missing",
            async () => {
                sessionService.findActive.mockRejectedValue(new SessionNotFoundException({
                    reason: "missing-token" 
                }))

                await expect(resolver.createTask({
                    headers: {
                    } 
                },
                {
                    title: "Write the report" 
                })).rejects.toMatchObject({
                    code: "SESSION_NOT_FOUND_EXCEPTION",
                })
                expect(sessionService.findActive).toHaveBeenCalledWith("")
                expect(commandBus.execute).not.toHaveBeenCalled()
            })

        it("ac.task.title.required.refuses-empty: the handler refusal propagates to the caller unchanged",
            async () => {
                commandBus.execute.mockRejectedValue(new TaskTitleRequiredException())

                await expect(resolver.createTask(req,
                    {
                        title: "   " 
                    })).rejects.toMatchObject({
                    code: "TASK_TITLE_REQUIRED_EXCEPTION",
                })
            })
    })
