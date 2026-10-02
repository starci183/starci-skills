import type { ExecutionContext } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { OperationRequest } from "./http-security.contracts"
import { requestOf } from "./execution-request.mapper"

const request: OperationRequest = { headers: {}, method: "GET", ip: "127.0.0.1" }

describe("requestOf", () => {
    it("reads the request from an HTTP execution context", () => {
        const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
        http.getRequest.mockReturnValue(request)
        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("http")
        context.switchToHttp.mockReturnValue(http)

        expect(requestOf(context)).toBe(request)
        expect(context.getArgs).not.toHaveBeenCalled()
    })

    it("reads the request from a GraphQL execution context", () => {
        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("graphql")
        context.getArgs.mockReturnValue([undefined, {}, { req: request }, undefined])

        expect(requestOf(context)).toBe(request)
        expect(context.switchToHttp).not.toHaveBeenCalled()
    })
})
