/** The failure codes of the test world; every world failure carries one so a run names what broke. */
export const TestWorldErrorCode = {
    /** `useTestWorld` was used before its `beforeAll` ran, or the globalSetup did not run. */
    NotBooted: "TEST_WORLD_NOT_BOOTED",
    /** A spec asked for an app, fake, connection or service the config does not declare. */
    NotDeclared: "TEST_WORLD_NOT_DECLARED",
    /** The state file the globalSetup publishes is absent or malformed. */
    StateMissing: "TEST_WORLD_STATE_MISSING",
    /** The declaration (`test-world.config.ts`) is invalid. */
    ConfigInvalid: "TEST_WORLD_CONFIG_INVALID",
    /** The stack definition (`.starcistacks/<env>`) cannot answer a service or an image. */
    StackDefinition: "TEST_WORLD_STACK_DEFINITION",
    /** Docker, toxiproxy, k3d or a service container failed. */
    InfrastructureFailed: "TEST_WORLD_INFRASTRUCTURE_FAILED",
    /** `waitFor` ran out of time. */
    TimedOut: "TEST_WORLD_TIMED_OUT",
    /** A fake refused a control call or a failure could not be armed. */
    FakeControlFailed: "TEST_WORLD_FAKE_CONTROL_FAILED",
    /** A person could not be registered or signed in. */
    SignInRefused: "TEST_WORLD_SIGN_IN_REFUSED",
    /** The migrate step failed. */
    MigrateFailed: "TEST_WORLD_MIGRATE_FAILED",
    /** Another run holds the same namespace (same repository checkout). */
    NamespaceBusy: "TEST_WORLD_NAMESPACE_BUSY",
} as const

/** One code of {@link TestWorldErrorCode}. */
export type TestWorldErrorCodeValue = (typeof TestWorldErrorCode)[keyof typeof TestWorldErrorCode]

/** What builds a {@link TestWorldError}. */
export interface TestWorldErrorInit {
    /** The failure code. */
    readonly code: TestWorldErrorCodeValue
    /** The parameters of the failure; `detail` is the sentence a human reads. */
    readonly params: { readonly detail: string } & Readonly<Record<string, unknown>>
    /** The underlying failure. */
    readonly cause?: unknown
}

/** The one error class of the library. */
export class TestWorldError extends Error {
    /** The failure code. */
    readonly code: TestWorldErrorCodeValue
    /** The parameters of the failure. */
    readonly params: TestWorldErrorInit["params"]

    constructor(init: TestWorldErrorInit) {
        super(`${init.code}: ${init.params.detail}`, init.cause === undefined ? undefined : { cause: init.cause })
        this.name = "TestWorldError"
        this.code = init.code
        this.params = init.params
    }
}

/** Shorthand used across the library. */
export const worldError = (code: TestWorldErrorCodeValue, detail: string, cause?: unknown): TestWorldError =>
    new TestWorldError({ code, params: { detail }, cause })
