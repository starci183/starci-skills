import { DomainError } from "@modules/platform/errors"

/** Codes of the test world: what can go wrong while it stands infrastructure up, boots an app, or reads a fake. */
export enum TestWorldErrorCode {
    /** The shared infrastructure (the stack, a database, a proxy) could not be started, reached or removed. */
    InfrastructureFailed = "TEST_WORLD_INFRASTRUCTURE_FAILED",
    /** The world state file of the run is absent or malformed: the jest globalSetup did not run. */
    StateMissing = "TEST_WORLD_STATE_MISSING",
    /** A spec asked the world for something before `beforeAll` booted it. */
    NotBooted = "TEST_WORLD_NOT_BOOTED",
    /** A spec asked for an app, a mode or a fake the world was not asked to provide. */
    NotDeclared = "TEST_WORLD_NOT_DECLARED",
    /** A control call to the fakes host was refused or malformed. */
    FakeControlFailed = "TEST_WORLD_FAKE_CONTROL_FAILED",
    /** The public sign-in door refused a person the world expected to be known to the identity provider. */
    SignInRefused = "TEST_WORLD_SIGN_IN_REFUSED",
    /** A payload fixture of a fake is not valid JSON once its placeholders are filled. */
    PayloadInvalid = "TEST_WORLD_PAYLOAD_INVALID",
    /** A code the public kind table of an integration is expected to carry is missing from it. */
    KindMissing = "TEST_WORLD_KIND_MISSING",
    /** A state the world waited for (a readiness probe, an asynchronous effect) did not arrive before its deadline. */
    TimedOut = "TEST_WORLD_TIMED_OUT",
}

/** The one error class of the test world; `params.detail` carries what a person needs to debug the run. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
