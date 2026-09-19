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
    ReopenTaskCommand 
} from "@modules/bussiness/task/reopen-task.command"
import {
    TaskForbiddenException 
} from "@modules/shared/exceptions/errors/task/task-forbidden"
import {
    TaskNotFoundException 
} from "@modules/shared/exceptions/errors/task/task-not-found"

import {
    ReopenTaskResolver 
} from "./reopen-task.resolver"

const req = {
    headers: {
        authorization: "Bearer token-1" 
    } 
}
const activeSession = new SessionRecord("token-1",
    "owner-1",
    new Date(),
    new Date(Date.now() + 60_000))

describe("ReopenTaskResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: ReopenTaskResolver
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
                    ReopenTaskResolver,
                    {
                        provide: CommandBus, useValue: commandBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(ReopenTaskResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("br.task.complete.once: resolves the caller, maps the id arg onto the command and returns the reopened state",
            async () => {
                commandBus.execute.mockResolvedValue({
                    taskId: "task-1", complete: false 
                })

                const response = await resolver.reopenTask(req,
                    "task-1")

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const command = commandBus.execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(ReopenTaskCommand)
                expect(command.params).toEqual({
                    actorId: "owner-1", taskId: "task-1" 
                })
                expect(response.taskId).toBe("task-1")
                expect(response.complete).toBe(false)
            })

        it("refuses before dispatching any command when the session cannot be resolved",
            async () => {
                sessionService.findActive.mockRejectedValue(new SessionNotFoundException())

                await expect(resolver.reopenTask(req,
                    "task-1")).rejects.toMatchObject({
                    code: "SESSION_NOT_FOUND_EXCEPTION" 
                })
                expect(commandBus.execute).not.toHaveBeenCalled()
            })

        it("propagates TASK_NOT_FOUND from the handler unchanged",
            async () => {
                commandBus.execute.mockRejectedValue(new TaskNotFoundException({
                    taskId: "task-1" 
                }))

                await expect(resolver.reopenTask(req,
                    "task-1")).rejects.toMatchObject({
                    code: "TASK_NOT_FOUND_EXCEPTION" 
                })
            })

        it("propagates TASK_FORBIDDEN when the task belongs to somebody else",
            async () => {
                commandBus.execute.mockRejectedValue(new TaskForbiddenException({
                    taskId: "task-1", actorId: "owner-1" 
                }))

                await expect(resolver.reopenTask(req,
                    "task-1")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
            })
    })
