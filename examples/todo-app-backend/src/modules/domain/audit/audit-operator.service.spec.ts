import {
    Test 
} from "@nestjs/testing"
import {
    AuditOperatorService 
} from "./audit-operator.service"

/**
 * decision.audit.operator-role's trusted source, in isolation. The operator claim is minted here and
 * nowhere else, from a server-side roster matched against the authenticated subject - never from a value
 * on the request - so this is where "an unverifiable claim must refuse" lives: a subject the roster does
 * not name simply has no claim.
 */
describe("AuditOperatorService (decision.audit.operator-role)",
    () => {
        const ENV = "AUDIT_OPERATOR_SUBJECTS"
        let saved: string | undefined

        beforeEach(() => {
            saved = process.env[ENV]
            delete process.env[ENV]
        })

        afterEach(() => {
            if (saved === undefined) delete process.env[ENV]
            else process.env[ENV] = saved
        })

        it("is fail-closed with no roster: nobody resolves to an operator",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    providers: [AuditOperatorService] 
                }).compile()
                try {
                    const service = moduleRef.get(AuditOperatorService)
                    expect(service.claimFor("anyone").role).toBeUndefined()
                    expect(service.isOperator("anyone")).toBe(false)
                } finally {
                    await moduleRef.close()
                }
            })

        it("grants the operator claim only to a subject the roster names",
            async () => {
                // The roster is an @Optional() non-DI constructor arg, so the spec supplies it through a factory.
                const moduleRef = await Test.createTestingModule({
                    providers: [{
                        provide: AuditOperatorService, useFactory: () => new AuditOperatorService(["op-1",
                            "op-2"]) 
                    }],
                }).compile()
                try {
                    const service = moduleRef.get(AuditOperatorService)
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

        it("reads the deployment roster from the environment, trimming and dropping blanks",
            async () => {
                process.env[ENV] = " op-1 , op-2 ,, "
                expect([...AuditOperatorService.subjectsFromEnv()]).toEqual(["op-1",
                    "op-2"])
                const moduleRef = await Test.createTestingModule({
                    providers: [AuditOperatorService] 
                }).compile()
                try {
                    const service = moduleRef.get(AuditOperatorService)
                    expect(service.isOperator("op-2")).toBe(true)
                    expect(service.isOperator("someone-else")).toBe(false)
                } finally {
                    await moduleRef.close()
                }
            })

        it("resolves through Nest dependency injection, falling back to the environment roster (fail-closed when unset)",
            async () => {
                // The real AuditModule.register() wires this into AuditLogHandler through the container, so the
                // @Optional() roster parameter must resolve via DI, not only when constructed by hand in a spec.
                const moduleRef = await Test.createTestingModule({
                    providers: [AuditOperatorService] 
                }).compile()
                try {
                    const service = moduleRef.get(AuditOperatorService)
                    expect(service.isOperator("anyone")).toBe(false)
                } finally {
                    await moduleRef.close()
                }
            })
    })
