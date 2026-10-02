import type { ExecutionContext } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Reflector } from "@nestjs/core"
import { mock } from "@starci/jest-preset"
import type { OperationRequest } from "@modules/platform/http-security"
import { AuthGuard } from "./auth.guard"
import { IdentityErrorCode } from "./errors/identity.error"
import type { SessionVerifier } from "./identity.contracts"
import { PUBLIC_KEY, ROLES_KEY, SESSION_VERIFIER } from "./identity.decorators"

class Door {}

const handler = (): void => undefined

const build = async (authorization?: string) => {
    const reflector = mock<Reflector>()
    const verifier = mock<SessionVerifier>()
    const request: OperationRequest = {
        headers: authorization === undefined ? {} : { authorization },
        method: "GET",
        ip: "127.0.0.1",
    }
    const host = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    host.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(Door)
    context.getType.mockReturnValue("http")
    context.switchToHttp.mockReturnValue(host)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthGuard,
            { provide: Reflector, useValue: reflector },
            { provide: SESSION_VERIFIER, useValue: verifier },
        ],
    }).compile()
    return { guard: moduleRef.get(AuthGuard), context, reflector, verifier, request }
}

describe("AuthGuard", () => {
    it("opens a door carrying public metadata without authenticating", async () => {
        const { guard, context, reflector, verifier } = await build()
        reflector.getAllAndOverride.mockReturnValue({ reason: "health" })

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PUBLIC_KEY, [handler, Door])
        expect(verifier.verify).not.toHaveBeenCalled()
    })

    it.each([undefined, "Basic credentials", "Bearer   "])(
        "refuses an absent or malformed bearer credential (%s)",
        async (authorization) => {
            const { guard, context, reflector, verifier } = await build(authorization)
            reflector.getAllAndOverride.mockReturnValue(undefined)

            await expect(guard.canActivate(context)).rejects.toMatchObject({
                code: IdentityErrorCode.Unauthenticated,
            })

            expect(verifier.verify).not.toHaveBeenCalled()
        },
    )

    it("refuses a bearer token with no live session", async () => {
        const { guard, context, reflector, verifier } = await build("Bearer session-token")
        reflector.getAllAndOverride.mockReturnValue(undefined)
        verifier.verify.mockResolvedValue(null)

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            code: IdentityErrorCode.Unauthenticated,
        })

        expect(verifier.verify).toHaveBeenCalledWith("session-token")
    })

    it("stamps an authenticated member on a door with no role metadata", async () => {
        const { guard, context, reflector, verifier, request } = await build("Bearer session-token")
        reflector.getAllAndOverride.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined)
        verifier.verify.mockResolvedValue({ personId: "person-1" })

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(2, ROLES_KEY, [handler, Door])
        expect(request.principal).toEqual({ id: "person-1", roles: ["member"] })
    })

    it("accepts a door whose required roles the principal has", async () => {
        const { guard, context, reflector, verifier, request } = await build("Bearer session-token")
        reflector.getAllAndOverride.mockReturnValueOnce(undefined).mockReturnValueOnce(["member"])
        verifier.verify.mockResolvedValue({ personId: "person-1" })

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(request.principal).toEqual({ id: "person-1", roles: ["member"] })
    })

    it("refuses a door when the principal lacks one required role", async () => {
        const { guard, context, reflector, verifier, request } = await build("Bearer session-token")
        reflector.getAllAndOverride.mockReturnValueOnce(undefined).mockReturnValueOnce(["member", "admin"])
        verifier.verify.mockResolvedValue({ personId: "person-1" })

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Forbidden })

        expect(request.principal).toBeUndefined()
    })
})
