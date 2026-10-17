import { Test } from "@nestjs/testing"
import type { ExecutionContext } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { OperationRequest } from "./http-security.contracts"
import { requestOf } from "./execution-request.mapper"

const request: OperationRequest = { headers: {}, method: "GET", ip: "127.0.0.1" }

const SUBJECT: unique symbol = Symbol("http-security/execution-request.mapper")
const subjectFunctions = () => ({ requestOf })

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: subjectFunctions }],
    }).compile()
    return moduleRef.get<ReturnType<typeof subjectFunctions>>(SUBJECT)
}

describe("requestOf", () => {
    it("reads the request from an HTTP execution context", async () => {
        const subject = await build()

        const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
        http.getRequest.mockReturnValue(request)
        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("http")
        context.switchToHttp.mockReturnValue(http)

        expect(subject.requestOf(context)).toBe(request)
        expect(context.getArgs).not.toHaveBeenCalled()
    })

    it("reads the request from a GraphQL execution context", async () => {
        const subject = await build()

        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("graphql")
        context.getArgs.mockReturnValue([undefined, {}, { req: request }, undefined])

        expect(subject.requestOf(context)).toBe(request)
        expect(context.switchToHttp).not.toHaveBeenCalled()
    })
})
