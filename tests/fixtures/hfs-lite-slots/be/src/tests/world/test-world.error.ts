import { DomainError } from "@modules/platform/errors"

/** Failures of the integration-world lifecycle. */
export enum TestWorldErrorCode {
    NotReady = "TEST_WORLD_NOT_READY",
}

/** A test tried to read the connection outside its beforeAll/afterAll lifetime. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
