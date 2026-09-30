import type { ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { AuthGuard } from "./auth.guard"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { PublicReason } from "./identity.contracts"
import type { SessionVerifier } from "./identity.contracts"
import { PUBLIC_KEY, ROLES_KEY } from "./identity.decorators"

interface Metadata {
    readonly reason?: PublicReason
    readonly roles?: ReadonlyArray<string>
}

const reflectorOf = (metadata: Metadata): Reflector =>
    mock<Reflector>({
        getAllAndOverride: jest.fn().mockImplementation((key: string) => {
            if (key === PUBLIC_KEY) return metadata.reason === undefined ? undefined : { reason: metadata.reason }
            return key === ROLES_KEY ? metadata.roles : undefined
        }),
    })

interface RequestFixture {
    headers: Record<string, string>
    principal?: Principal
}

interface ContextFixture {
    request: RequestFixture
    context: ExecutionContext
}

const requestOfContext = (headers: Record<string, string>): ContextFixture => {
    const request: RequestFixture = { headers }
    const context = mock<ExecutionContext>({
        getType: jest.fn().mockReturnValue("http"),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({ getRequest: () => request }),
    })
    return { request, context }
}

const verifierFor = (personId: string | null): SessionVerifier => ({
    verify: jest.fn().mockResolvedValue(personId === null ? null : { personId }),
})

describe("AuthGuard", () => {
    it("lets a door marked public through without looking at the request", async () => {
        const verifier = verifierFor("p-1")
        const { context } = requestOfContext({})
        await expect(new AuthGuard(reflectorOf({ reason: PublicReason.Health }), verifier).canActivate(context)).resolves.toBe(true)
        expect(verifier.verify).not.toHaveBeenCalled()
    })

    it("stamps the principal of a live bearer token on the request", async () => {
        const { request, context } = requestOfContext({ authorization: "Bearer live" })
        const verifier = verifierFor("p-1")
        await expect(new AuthGuard(reflectorOf({}), verifier).canActivate(context)).resolves.toBe(true)
        expect(verifier.verify).toHaveBeenCalledWith("live")
        expect(request.principal).toEqual({ id: "p-1", roles: ["member"] })
    })

    it("refuses a request without a bearer token and a token no session answers", async () => {
        const missing = requestOfContext({}).context
        const dead = requestOfContext({ authorization: "Bearer dead" }).context
        await expect(new AuthGuard(reflectorOf({}), verifierFor("p-1")).canActivate(missing)).rejects.toThrow(
            new IdentityError({ code: IdentityErrorCode.Unauthenticated }),
        )
        await expect(new AuthGuard(reflectorOf({}), verifierFor(null)).canActivate(dead)).rejects.toThrow(
            new IdentityError({ code: IdentityErrorCode.Unauthenticated }),
        )
    })

    it("refuses an authenticated caller who lacks a required role", async () => {
        const { context } = requestOfContext({ authorization: "Bearer live" })
        const guard = new AuthGuard(reflectorOf({ roles: ["admin"] }), verifierFor("p-1"))
        await expect(guard.canActivate(context)).rejects.toThrow(new IdentityError({ code: IdentityErrorCode.Forbidden }))
    })
})
