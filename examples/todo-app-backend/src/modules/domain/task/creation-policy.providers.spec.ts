import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CreateTaskInputParams, CreateTaskPrincipalParams, TaskCreationPolicy 
} from "./creation-policy.contracts"
import {
    TaskCreationPolicyRegistry 
} from "./creation-policy.providers"
class Refusal extends Error {
    readonly code: string

    constructor(code: string) {
        super(`refused by ${code}`)
        this.code = code
    }
}

class RefusingPolicy extends TaskCreationPolicy {
    constructor(private readonly code: string) {
        super()
    }

    async assertMayCreate(): Promise<void> {
        throw new Refusal(this.code)
    }
}

class RecordingPolicy extends TaskCreationPolicy {
    readonly calls: Array<CreateTaskInputParams> = []

    async assertMayCreate(_principal: CreateTaskPrincipalParams, input: CreateTaskInputParams): Promise<void> {
        this.calls.push(input)
    }
}

/**
 * The seam PlanCapGuardPolicy plugs into (sds.plan.cap-guard appliesTo fr.task.create), in isolation:
 * empty by default, every registered policy consulted in order, the first refusal wins.
 */
describe("TaskCreationPolicyRegistry",
    () => {
        let moduleRef: TestingModule
        let registry: TaskCreationPolicyRegistry

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [TaskCreationPolicyRegistry] 
            }).compile()
            registry = moduleRef.get(TaskCreationPolicyRegistry)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        const principal: CreateTaskPrincipalParams = {
            actorId: "owner-1" 
        }
        const input: CreateTaskInputParams = {
            title: "a task" 
        }

        it("with nothing registered, creation is never refused",
            async () => {
                await expect(registry.assertMayCreate(principal,
                    input)).resolves.toBeUndefined()
            })

        it("a registered policy that has nothing to say still resolves",
            async () => {
                registry.register(new RecordingPolicy())
                await expect(registry.assertMayCreate(principal,
                    input)).resolves.toBeUndefined()
            })

        it("a refusing policy propagates its own typed refusal",
            async () => {
                registry.register(new RefusingPolicy("SOME_CAP"))
                await expect(registry.assertMayCreate(principal,
                    input)).rejects.toMatchObject({
                    code: "SOME_CAP" 
                })
            })

        it("policies run in registration order and the first refusal wins: later policies are never consulted",
            async () => {
                const consulted = new RecordingPolicy()
                registry.register(new RefusingPolicy("FIRST_REFUSAL"))
                registry.register(consulted)

                await expect(registry.assertMayCreate(principal,
                    input)).rejects.toMatchObject({
                    code: "FIRST_REFUSAL" 
                })
                expect(consulted.calls).toHaveLength(0)
            })
    })
