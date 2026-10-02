import type { ExecutionContext } from "@nestjs/common"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { requestOf } from "./execution-request.mapper"

describe("requestOf", () => {
    it("reads the HTTP request behind an execution context", () => {
        const request = mock<Request>()
        const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
        http.getRequest.mockReturnValue(request)
        const context = mock<ExecutionContext>()
        context.switchToHttp.mockReturnValue(http)

        expect(requestOf(context)).toBe(request)
    })
})
