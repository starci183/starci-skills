import { Test } from "@nestjs/testing"
import type { ExecutionContext } from "@nestjs/common"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { requestOf } from "./execution-request.mapper"

const SUBJECT = Symbol("subject")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { requestOf } }],
    }).compile()
    return moduleRef.get<typeof import("./execution-request.mapper")>(SUBJECT)
}

describe("requestOf", () => {
    it("reads the HTTP request behind an execution context", async () => {
        const subject = await build()
        const request = mock<Request>()
        const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
        http.getRequest.mockReturnValue(request)
        const context = mock<ExecutionContext>()
        context.switchToHttp.mockReturnValue(http)

        expect(subject.requestOf(context)).toBe(request)
    })
})
