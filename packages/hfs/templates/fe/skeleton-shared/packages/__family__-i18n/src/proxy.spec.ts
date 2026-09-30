import { defineRouting } from "next-intl/routing"
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { createProxy } from "./proxy"

const proxy = createProxy(defineRouting({ locales: ["vi", "en"], defaultLocale: "vi", localePrefix: "as-needed" }))
const call = (path: string) => proxy(new NextRequest(`http://app.test${path}`))

describe("createProxy", () => {
    it.each(["/api/session", "/health/live", "/_next/static/a.js", "/favicon.ico"])("lets %s through untouched", (path) => {
        expect(call(path).headers.get("x-middleware-next")).toBe("1")
    })

    it("negotiates a page path", () => {
        expect(call("/en/pricing").headers.get("x-middleware-request-x-next-intl-locale")).toBe("en")
    })
})
