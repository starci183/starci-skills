import type { ExecutionContext } from "@nestjs/common"
import type { Request } from "express"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { requestOf } from "./execution-request.mapper"

const REQUEST_MAPPER = Symbol("REQUEST_MAPPER")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: REQUEST_MAPPER, useValue: requestOf }],
    }).compile()
    return moduleRef.get<typeof requestOf>(REQUEST_MAPPER)
}

describe("requestOf", () => {
    it("reads the HTTP request behind an HTTP execution context", async () => {
        const mapRequest = await build()
        const request = mock<Request>()
        const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
        http.getRequest.mockReturnValue(request)
        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("http")
        context.switchToHttp.mockReturnValue(http)

        expect(mapRequest(context)).toBe(request)
        expect(context.getArgs).not.toHaveBeenCalled()
    })

    it("reads the request of the GraphQL context behind a resolver's execution context", async () => {
        const mapRequest = await build()
        const request = mock<Request>()
        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("graphql")
        context.getArgs.mockReturnValue([undefined, {}, { req: request }, undefined])

        expect(mapRequest(context)).toBe(request)
        expect(context.switchToHttp).not.toHaveBeenCalled()
    })
})
