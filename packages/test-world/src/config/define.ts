import type { FakeDefinition } from "../fakes/framework/contracts"
import { createSandbox } from "../nest/sandbox"
import type { SandboxHandle, SandboxSpec } from "../nest/sandbox"
import { World } from "../nest/world"
import type { TestWorld, WorldSpec } from "../nest/world-types"
import { rememberDeclaration } from "./registry"
import type { AnyTestWorldConfig, RegisterableModule, SiblingServiceDeclaration, StacksDeclaration, TestWorldConfig } from "./types"

const BOOT_TIMEOUT_MS = 240_000
const STOP_TIMEOUT_MS = 60_000
const DEFAULT_TEST_TIMEOUT_MS = 120_000

/** What `defineTestWorld` answers: the one function a spec calls. */
export interface DefinedTestWorld<
    TApps extends Readonly<Record<string, RegisterableModule<never>>>,
    TFakes,
    TSiblings extends Readonly<Record<string, SiblingServiceDeclaration>>,
    TStacks extends StacksDeclaration,
> {
    /**
     * Registers the hooks that boot and close the world around the spec and answers the handle; call it inside `describe`.
     * `{ apps: ["todo"] }` (or an object keyed by app name) boots real apps of the declaration; `{ modules: [...] }` boots only
     * those capability modules over the declaration's platform base.
     */
    useTestWorld(spec: WorldSpec<keyof TApps & string>): TestWorld<TApps, TFakes, TSiblings, TStacks>
    /**
     * The contract layer: the REAL integration client against a provider sandbox, in a `contract-spec`. The library reads the
     * sandbox keys from the environment and skips the described body when one is absent; the spec never touches the environment.
     */
    useSandbox<T>(spec: SandboxSpec<T>): SandboxHandle<T>
}

/**
 * The ONE declaration of a repository's test world, written in `src/tests/world/test-world.config.ts`:
 * `export const { useTestWorld, useSandbox } = defineTestWorld({ stack, stacks, k3d, services, fakes, apps, migrate, identity })`, the one
 * named form R47 reads (R89 refuses a default export); `use-test-world.ts` re-exports `useTestWorld` and `useSandbox`, the entry the specs import.
 * Selection and overrides only: service list and image versions come from the stack definition. The jest globalSetup
 * (`@starci/test-world/global-setup`) loads this file, attaches to (or starts) the shared warm stack, migrates once and
 * publishes the run; specs then only call `useTestWorld`.
 */
export const defineTestWorld = <
    TApps extends Readonly<Record<string, RegisterableModule<never>>>,
    TFakes extends Readonly<Record<string, FakeDefinition>> = Readonly<Record<string, never>>,
    TSiblings extends Readonly<Record<string, SiblingServiceDeclaration>> = Readonly<Record<string, never>>,
    const TStacks extends StacksDeclaration = StacksDeclaration,
    TMigrate = never,
>(
    config: TestWorldConfig<TApps, TFakes, TSiblings, TStacks, TMigrate>,
): DefinedTestWorld<TApps, TFakes, TSiblings, TStacks> => {
    const declaration = config as unknown as AnyTestWorldConfig
    rememberDeclaration(declaration)
    return {
        useSandbox: (spec) => createSandbox(spec, () => declaration.sandbox?.base() ?? []),
        useTestWorld: (spec) => {
            jest.setTimeout(spec.testTimeoutMs ?? DEFAULT_TEST_TIMEOUT_MS)
            const world = new World(declaration, spec as WorldSpec)
            beforeAll(() => world.start(), BOOT_TIMEOUT_MS)
            // Each test holds the run's outage lock shared: another file's outage waits for it, and it waits for that outage to end.
            beforeEach(() => world.enterTest())
            afterEach(() => world.leaveTest())
            afterAll(() => world.stop(), STOP_TIMEOUT_MS)
            return world as unknown as TestWorld<TApps, TFakes, TSiblings, TStacks>
        },
    }
}
