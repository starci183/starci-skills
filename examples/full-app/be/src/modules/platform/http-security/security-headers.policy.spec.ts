import { Test } from "@nestjs/testing"
import type { INestApplication } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { Application, NextFunction, Request, Response } from "express"
import { applySecurityHeaders } from "./security-headers.policy"

const SUBJECT: unique symbol = Symbol("http-security/security-headers.policy")
const subjectFunctions = () => ({ applySecurityHeaders })

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: subjectFunctions }],
    }).compile()
    return moduleRef.get<ReturnType<typeof subjectFunctions>>(SUBJECT)
}

describe("applySecurityHeaders", () => {
    it("removes the Express fingerprint and applies protective headers before continuing the request", async () => {
        const subject = await build()

        const server = mock<Application>()
        const disabled = new Set<string>()
        server.disable.mockImplementation((name: string) => {
            disabled.add(name)
            return server
        })
        const adapter = mock<ReturnType<INestApplication["getHttpAdapter"]>>()
        adapter.getInstance.mockReturnValue(server)
        const app = mock<INestApplication>()
        app.getHttpAdapter.mockReturnValue(adapter)
        const response = mock<Response>()
        const headers = new Map<string, number | string | ReadonlyArray<string>>()
        response.setHeader.mockImplementation((name, value) => {
            headers.set(name, value)
            return response
        })
        let nextCalls = 0
        const next = (): void => {
            nextCalls += 1
        }
        app.use.mockImplementation((middleware: (request: Request, response: Response, next: NextFunction) => void) => {
            middleware(mock<Request>(), response, next)
            return app
        })

        subject.applySecurityHeaders(app)

        expect(disabled.has("x-powered-by")).toBe(true)
        expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains")
        expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
        expect(headers.get("X-Frame-Options")).toBe("DENY")
        expect(headers.get("Referrer-Policy")).toBe("no-referrer")
        expect(headers.get("Content-Security-Policy")).toBe(
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        )
        expect(nextCalls).toBe(1)
    })

    it.each([null, 1, {}, { disable: jest.fn() }])(
        "refuses an HTTP adapter whose instance %p is no express application",
        async (instance) => {
            const subject = await build()
            const adapter = mock<ReturnType<INestApplication["getHttpAdapter"]>>()
            adapter.getInstance.mockReturnValue(instance)
            const app = mock<INestApplication>()
            app.getHttpAdapter.mockReturnValue(adapter)

            expect(() => subject.applySecurityHeaders(app)).toThrow("HTTP_SECURITY_REQUEST_INVALID")
            expect(app.use).not.toHaveBeenCalled()
        },
    )

    it("accepts an express application that is a function or a plain object", async () => {
        const subject = await build()
        const callable = Object.assign(() => undefined, { disable: jest.fn(), set: jest.fn() })
        const plain = { disable: jest.fn(), set: jest.fn() }
        for (const server of [callable, plain]) {
            const adapter = mock<ReturnType<INestApplication["getHttpAdapter"]>>()
            adapter.getInstance.mockReturnValue(server)
            const app = mock<INestApplication>()
            app.getHttpAdapter.mockReturnValue(adapter)

            subject.applySecurityHeaders(app)

            expect(server.disable).toHaveBeenCalledWith("x-powered-by")
        }
    })
})
