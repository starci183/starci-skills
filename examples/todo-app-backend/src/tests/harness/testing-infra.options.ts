/**
 * The register() contract every e2e spec codes against. Kept in its own file (no imports) so the
 * module and the services can all reference the token without a circular dependency.
 */

export enum TestContext {
  /** Boots the run-owned docker stack plus the api child process; the only context this app has. */
  E2E = "e2e",
}

/**
 * The register() options every e2e spec codes against - which world to stand up, and optionally the
 * identity the stack's compose project name is hashed from.
 */
export interface TestingInfraOptions {
  readonly context: TestContext;
  /**
   * Defaults to the running spec file path (expect.getState().testPath). The compose project name is
   * a hash of it, so two spec files never share a stack even if jest later runs them in parallel.
   */
  readonly specId?: string;
}

export const TESTING_INFRA_OPTIONS = Symbol("TESTING_INFRA_OPTIONS")

/**
 * Stack boot can take minutes on a cold docker (image pull + keycloak realm import). Specs pass this
 * as the beforeAll hook timeout so the 120s test timeout still governs the journey itself.
 */
export const E2E_BOOT_TIMEOUT_MS = 600_000
