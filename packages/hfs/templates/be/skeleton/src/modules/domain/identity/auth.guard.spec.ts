import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AuthGuard } from "./auth.guard"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

const build = async (metadata: PublicMetadata | undefined) => {
    const reflector = mock<Reflector>()
    reflector.getAllAndOverride.mockReturnValue(metadata)
    const moduleRef = await Test.createTestingModule({
        providers: [AuthGuard, { provide: Reflector, useValue: reflector }],
    }).compile()
    return { guard: moduleRef.get(AuthGuard), reflector }
}

const contextOf = () => {
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(() => undefined)
    context.getClass.mockReturnValue(class Door {})
    return context
}

describe("AuthGuard", () => {
    it("lets a door through when it states why it is public", async () => {
        const { guard } = await build({ reason: PublicReason.Health })

        expect(guard.canActivate(contextOf())).toBe(true)
    })

    it("refuses every door that is not public", async () => {
        const { guard } = await build(undefined)

        expect(() => guard.canActivate(contextOf())).toThrow(
            expect.objectContaining({ code: IdentityErrorCode.Unauthenticated }),
        )
    })
})
