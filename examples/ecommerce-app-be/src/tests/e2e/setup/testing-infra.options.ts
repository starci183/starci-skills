/** Which testing world TestingInfraModule stands up - picked once per spec at register time. */
export enum TestContext {
  /** The flow lane: a run-scoped compose stack plus both api child processes on loopback ports. */
  E2E = "e2e",
}

/** The options TestingInfraModule.register consumes for one spec's stack. */
export interface TestingInfraOptions {
  context: TestContext;
  /** Stable id for the spec (e.g. 'identity/sign-up-sign-in'); hashed into the compose project name. */
  specId?: string;
}

export const TESTING_INFRA_OPTIONS = "TESTING_INFRA_OPTIONS"
