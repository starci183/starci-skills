import type { ExecutionContext } from "@nestjs/common"
import { mock } from "@starci/jest-preset/mock"
import { HttpSecurityError } from "./errors/http-security.error"
import { OriginGuard } from "./origin.guard"

const guard = new OriginGuard({
    allowedOrigins: ["https://shop.example"],
    rateLimit: { windowMs: 1000, defaultLimit: 1, strictLimit: 1 },
})

const contextOf = (method: string, headers: Record<string, string>): ExecutionContext =>
    mock<ExecutionContext>({
        getType: jest.fn().mockReturnValue("http"),
        switchToHttp: jest.fn().mockReturnValue({ getRequest: () => ({ method, headers }) }),
    })

describe("OriginGuard", () => {
    it("lets safe methods through without looking at the origin", () => {
        expect(guard.canActivate(contextOf("GET", { origin: "https://evil.example" }))).toBe(true)
    })

    it("lets a state-changing request from an allowed origin through", () => {
        expect(guard.canActivate(contextOf("POST", { origin: "https://shop.example" }))).toBe(true)
        expect(guard.canActivate(contextOf("POST", { referer: "https://shop.example/cart" }))).toBe(true)
    })

    it("refuses a state-changing request from another origin", () => {
        expect(() => guard.canActivate(contextOf("POST", { origin: "https://evil.example" }))).toThrow(HttpSecurityError)
    })

    it("lets a request without Origin and Referer through: it is not a browser", () => {
        expect(guard.canActivate(contextOf("POST", {}))).toBe(true)
    })
})
