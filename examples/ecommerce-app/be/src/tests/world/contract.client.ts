/**
 * The helper of the contract layer: builds the REAL integration client against a provider SANDBOX, so a contract spec can
 * check that the fake at the network edge still behaves like the provider. Sandbox coordinates come only from the process
 * environment under `CONTRACT_<PROVIDER>_*` keys (never committed, never printed); when any required key is absent the
 * spec is skipped, so a plain checkout stays green without credentials.
 */
import "reflect-metadata"
import { Module } from "@nestjs/common"
import type { DynamicModule, INestApplicationContext, Type } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { EnvSource } from "@modules/platform/config"
import type { ModuleRegistration } from "./test-world.contracts"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

const BOOT_TIMEOUT_MS = 60_000

/** What builds one real client. */
export interface ContractClientSpec<T> {
    /** The provider name, for the skip message. */
    readonly provider: string
    /** The environment keys the sandbox needs; every one must be declared for the spec to run. */
    readonly keys: ReadonlyArray<string>
    /** The integration module registered with sandbox options read from the environment, spreading the registration the world gives. */
    readonly module: (env: EnvSource, registration: ModuleRegistration) => DynamicModule
    /** The token of the client inside that module: its class, or its injection symbol. */
    readonly client: Type<T> | symbol
}

/** The handle a contract spec holds. */
export interface ContractClient<T> {
    /** True when every required key is declared. */
    readonly available: boolean
    /** `describe` when the sandbox is configured, `describe.skip` (naming the missing keys) when it is not; the client is built for the body. */
    describe(name: string, body: () => void): void
    /** The real client, valid inside the described body. */
    client(): T
    /** The environment the sandbox options were read from, for the raw calls of a spec. */
    env(): EnvSource
}

@Module({})
/** The root of a contract client: the integration module under test. */
class ContractRoot {
    /** Composes the root. */
    static register(integration: DynamicModule): DynamicModule {
        return { module: ContractRoot, imports: [integration] }
    }
}

/** Builds the contract client of one provider; nothing is read or booted until the described body runs. */
export const contractClient = <T>(spec: ContractClientSpec<T>): ContractClient<T> => {
    const env = EnvSource.fromProcess()
    const missing = spec.keys.filter((key) => !env.has(key))
    let context: INestApplicationContext | null = null
    return {
        available: missing.length === 0,
        env: () => env,
        client: () => {
            if (context === null)
                throw new TestWorldError({
                    code: TestWorldErrorCode.NotBooted,
                    params: { detail: `the ${spec.provider} contract client was used outside its describe` },
                })
            return context.get<T, T>(spec.client, { strict: false })
        },
        describe: (name, body) => {
            const run = missing.length === 0 ? describe : describe.skip
            run(
                missing.length === 0
                    ? name
                    : `${name} (skipped: ${spec.provider} sandbox keys not declared: ${missing.join(", ")})`,
                () => {
                    beforeAll(async () => {
                        context = await NestFactory.createApplicationContext(
                            ContractRoot.register(spec.module(env, { isGlobal: true })),
                            {
                                logger: ["error"],
                            },
                        )
                    }, BOOT_TIMEOUT_MS)
                    afterAll(async () => {
                        await context?.close()
                        context = null
                    })
                    body()
                },
            )
        },
    }
}
