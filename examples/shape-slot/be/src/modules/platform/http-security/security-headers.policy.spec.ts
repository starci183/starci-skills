import { Test } from "@nestjs/testing"
import type { Request, Response } from "express"
import { mock } from "@starci/jest-preset"
import { securityHeaders } from "./security-headers.policy"

const SUBJECT = Symbol("subject")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { securityHeaders } }],
    }).compile()
    return moduleRef.get<typeof import("./security-headers.policy")>(SUBJECT)
}

describe("securityHeaders", () => {
    it("removes the framework header and supplies browser protections before the next handler", async () => {
        const subject = await build()
        const headers = new Map<string, string | number | ReadonlyArray<string>>([["X-Powered-By", "Express"]])
        const response = mock<Response>()
        response.removeHeader.mockImplementation((name) => {
            headers.delete(name)
        })
        response.setHeader.mockImplementation((name, value) => {
            headers.set(name, value)
            return response
        })
        let continued = false

        subject.securityHeaders(mock<Request>(), response, () => {
            continued = true
        })

        expect(Object.fromEntries(headers)).toEqual({
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            "Cache-Control": "no-store",
        })
        expect(continued).toBe(true)
    })
})
