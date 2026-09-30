import type { ExecutionContext } from "@nestjs/common"
import type { HttpArgumentsHost } from "@nestjs/common/interfaces"
import type { Reflector } from "@nestjs/core"
import type { Request } from "express"
import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { AuthGuard } from "./auth.guard"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { PublicReason } from "./identity.contracts"
import { PUBLIC_KEY, ROLES_KEY } from "./identity.decorators"
import type { SessionService } from "./session.service"

const AT = new Date("2026-09-30T10:00:00.000Z")
const VIEW = { token: "t1", personId: "p1", issuedAt: AT, expiresAt: AT }

interface Rig {
    readonly guard: AuthGuard
    readonly context: ExecutionContext
    readonly request: Request
    readonly sessions: SessionService
}

interface GuardMetadata {
    readonly public?: boolean
    readonly roles?: ReadonlyArray<string>
}

const build = (metadata: GuardMetadata, authorization?: string): Rig => {
    const reflector = mock<Reflector>({
        getAllAndOverride: jest
            .fn()
            .mockImplementation((key: string) =>
                key === PUBLIC_KEY ? (metadata.public ? { reason: PublicReason.Health } : undefined) : metadata.roles,
            ),
    })
    const request = mock<Request>({ headers: authorization === undefined ? {} : { authorization } })
    const http = mock<HttpArgumentsHost>({ getRequest: jest.fn().mockReturnValue(request) })
    const context = mock<ExecutionContext>({
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getType: jest.fn().mockReturnValue("http"),
        switchToHttp: () => http,
    })
    const sessions = mock<SessionService>({
        find: jest.fn().mockResolvedValue({ kind: "ok", value: VIEW }),
        principalOf: jest.fn().mockReturnValue({ id: "p1", roles: ["member"] }),
    })
    return { guard: new AuthGuard(reflector, new FakeClock(AT), sessions), context, request, sessions }
}

describe("AuthGuard", () => {
    it("lets a public door through without looking at the session", async () => {
        const { guard, context, sessions } = build({ public: true })
        await expect(guard.canActivate(context)).resolves.toBe(true)
        expect(sessions.find).not.toHaveBeenCalled()
    })

    it("authenticates a bearer token and stamps the principal on the request", async () => {
        const { guard, context, request, sessions } = build({}, "Bearer t1")
        await expect(guard.canActivate(context)).resolves.toBe(true)
        expect(sessions.find).toHaveBeenCalledWith({ token: "t1", at: AT })
        expect(request.principal).toEqual({ id: "p1", roles: ["member"] })
    })

    it("refuses a request without a bearer token as not found, never as a lookup of an undefined token", async () => {
        const { guard, context, sessions } = build({})
        jest.mocked(sessions.find).mockResolvedValue({ kind: "refused", code: IdentityErrorCode.NotFound })
        await expect(guard.canActivate(context)).rejects.toThrow(IdentityError)
        expect(sessions.find).toHaveBeenCalledWith({ token: "", at: AT })
    })

    it("turns a refusal of the store into the session error", async () => {
        const { guard, context, sessions } = build({}, "Bearer t1")
        jest.mocked(sessions.find).mockResolvedValue({ kind: "refused", code: IdentityErrorCode.Expired })
        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Expired })
    })

    it("refuses a caller that lacks a required role", async () => {
        const { guard, context } = build({ roles: ["admin"] }, "Bearer t1")
        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Forbidden })
    })

    it("uses the roles metadata key", () => {
        expect(ROLES_KEY).toBe("domain.identity.roles")
    })
})
