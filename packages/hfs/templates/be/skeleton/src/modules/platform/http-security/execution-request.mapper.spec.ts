import type { ExecutionContext } from "@nestjs/common"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { requestOf } from "./execution-request.mapper"

describe("requestOf", () => {
    it("reads the HTTP request behind an HTTP execution context", () => {
        const request = mock<Request>()
        const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
        http.getRequest.mockReturnValue(request)
        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("http")
        context.switchToHttp.mockReturnValue(http)

        expect(requestOf(context)).toBe(request)
        expect(context.getArgs).not.toHaveBeenCalled()
    })

    it("reads the request of the GraphQL context behind a resolver's execution context", () => {
        const request = mock<Request>()
        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("graphql")
        context.getArgs.mockReturnValue([undefined, {}, { req: request }, undefined])

        expect(requestOf(context)).toBe(request)
        expect(context.switchToHttp).not.toHaveBeenCalled()
    })
})
