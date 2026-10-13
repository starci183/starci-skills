import type { ExecutionContext } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { Request } from "express"
import { requestOf } from "./execution-request.mapper"

describe("requestOf", () => {
    it("reads the request from an HTTP execution context", () => {
        const request = mock<Request>({ headers: {}, method: "GET", ip: "127.0.0.1" })
        const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
        http.getRequest.mockReturnValue(request)
        const context = mock<ExecutionContext>()
        context.switchToHttp.mockReturnValue(http)

        expect(requestOf(context)).toBe(request)
        expect(context.switchToHttp).toHaveBeenCalledTimes(1)
    })
})
