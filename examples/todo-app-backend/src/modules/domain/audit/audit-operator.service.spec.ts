import {
    Test
} from "@nestjs/testing"
import {
    AUDIT_OPERATOR_SUBJECTS, AuditOperatorService
} from "./audit-operator.service"

const build = async (roster: ReadonlyArray<string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuditOperatorService,
            {
                provide: AUDIT_OPERATOR_SUBJECTS, useValue: roster
            },
        ],
    }).compile()
    return {
        moduleRef, service: moduleRef.get(AuditOperatorService)
    }
}

/**
 * decision.audit.operator-role's trusted source, in isolation. The operator claim is minted here and
 * nowhere else, from a server-side roster matched against the authenticated subject - never from a value
 * on the request - so this is where "an unverifiable claim must refuse" lives: a subject the roster does
 * not name simply has no claim.
 */
describe("AuditOperatorService (decision.audit.operator-role)",
    () => {
        it("is fail-closed with an empty roster: nobody resolves to an operator",
            async () => {
                const { moduleRef, service } = await build([])
                try {
                    expect(service.claimFor("anyone").role).toBeUndefined()
                    expect(service.isOperator("anyone")).toBe(false)
                } finally {
                    await moduleRef.close()
                }
            })

        it("grants the operator claim only to a subject the roster names",
            async () => {
                const { moduleRef, service } = await build(["op-1",
                    "op-2"])
                try {
                    expect(service.claimFor("op-1")).toEqual({
                        personId: "op-1", role: "operator"
                    })
                    expect(service.isOperator("op-2")).toBe(true)
                    expect(service.isOperator("person-1")).toBe(false)
                    expect(service.claimFor("person-1").role).toBeUndefined()
                } finally {
                    await moduleRef.close()
                }
            })
    })
