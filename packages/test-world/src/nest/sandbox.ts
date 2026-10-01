/**
 * The contract layer helper: builds the REAL integration client against a provider SANDBOX, so a contract spec can check that
 * the fake at the network edge still behaves like the provider. Sandbox coordinates come only from the process environment
 * under the keys the spec names (never committed, never printed); the library, not the spec, reads them, and when any
 * required key is absent the described body is skipped by the library, so a plain checkout stays green without credentials.
 */
import { Module } from "@nestjs/common"
import type { DynamicModule, INestApplicationContext, Type } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { TestWorldErrorCode, worldError } from "../errors"

const BOOT_TIMEOUT_MS = 60_000

/** How a module of the sandbox is registered: as the app root does, global. */
export interface ModuleRegistration {
    /** Always global: the capability is consumed through its injectors. */
    readonly isGlobal: true
}

/** What builds one real client. */
export interface SandboxSpec<T> {
    /** The provider name, for the skip message. */
    readonly provider: string
    /** The environment keys the sandbox needs; every one must be declared for the body to run. */
    readonly keys: ReadonlyArray<string>
    /** The integration module registered with the sandbox values, spreading the registration the library gives. `values` holds the declared keys. */
    readonly module: (values: Readonly<Record<string, string>>, registration: ModuleRegistration) => DynamicModule
    /** The token of the client inside that module: its class, or its injection symbol. */
    readonly client: Type<T> | symbol
}

/** One raw JSON call to a provider. */
export interface SandboxRequest {
    readonly method: "GET" | "POST" | "PUT" | "DELETE"
    /** The absolute URL. */
    readonly url: string
    readonly headers?: Readonly<Record<string, string>>
    /** A JSON body, sent as `application/json`. */
    readonly body?: unknown
}

/** A raw JSON call and what came back: the status and the parsed JSON body (or the text when it is not JSON). */
export interface SandboxAnswer {
    readonly status: number
    readonly body: unknown
}

/** The handle a contract spec holds. */
export interface SandboxHandle<T> {
    /** True when every required key is declared. */
    readonly available: boolean
    /** `describe` when the sandbox is configured, `describe.skip` (naming the missing keys) when it is not; the client is built for the body. */
    describe(name: string, body: () => void): void
    /** The real client, valid inside the described body. */
    client(): T
    /** One declared sandbox value (the base URL, the API key) for the raw calls of a spec. */
    value(key: string): string
    /** A raw JSON call to the provider, for comparing the real payload (not what the client parsed out of it) with a fixture. */
    fetchJson(request: SandboxRequest): Promise<SandboxAnswer>
}

@Module({})
/** The root of a sandbox client: the repository's outbound ports plus the integration module under test. */
class SandboxRoot {
    /** Composes the root. */
    static register(base: ReadonlyArray<DynamicModule>, integration: DynamicModule): DynamicModule {
        return { module: SandboxRoot, imports: [...base, integration] }
    }
}

const readJson = (text: string): unknown => {
    try {
        return JSON.parse(text) as unknown
    } catch {
        return text
    }
}

/** Builds the sandbox handle of one provider; nothing is booted until the described body runs. */
export const createSandbox = <T>(spec: SandboxSpec<T>, base: () => ReadonlyArray<DynamicModule>): SandboxHandle<T> => {
    const values: Record<string, string> = {}
    for (const key of spec.keys) {
        const value = process.env[key]
        if (value !== undefined && value !== "") values[key] = value
    }
    const missing = spec.keys.filter((key) => values[key] === undefined)
    let context: INestApplicationContext | null = null
    return {
        available: missing.length === 0,
        value: (key) => {
            const value = values[key]
            if (value === undefined) throw worldError(TestWorldErrorCode.NotDeclared, `the ${spec.provider} sandbox key ${key} is not declared`)
            return value
        },
        client: () => {
            if (context === null) throw worldError(TestWorldErrorCode.NotBooted, `the ${spec.provider} sandbox client was used outside its describe`)
            return context.get<T, T>(spec.client, { strict: false })
        },
        fetchJson: async (request) => {
            const response = await fetch(request.url, {
                method: request.method,
                headers: { ...(request.body === undefined ? {} : { "content-type": "application/json" }), ...request.headers },
                body: request.body === undefined ? undefined : JSON.stringify(request.body),
                signal: AbortSignal.timeout(30_000),
            })
            return { status: response.status, body: readJson(await response.text()) }
        },
        describe: (name, body) => {
            const run = missing.length === 0 ? describe : describe.skip
            run(missing.length === 0 ? name : `${name} (skipped: ${spec.provider} sandbox keys not declared: ${missing.join(", ")})`, () => {
                beforeAll(async () => {
                    context = await NestFactory.createApplicationContext(SandboxRoot.register(base(), spec.module(values, { isGlobal: true })), { logger: ["error"] })
                }, BOOT_TIMEOUT_MS)
                afterAll(async () => {
                    await context?.close()
                    context = null
                })
                body()
            })
        },
    }
}
