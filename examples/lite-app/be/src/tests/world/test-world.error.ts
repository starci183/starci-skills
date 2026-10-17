import { DomainError } from "@modules/platform/errors"

/** Deliberate failures injected by the integration proofs. */
export enum TestWorldErrorCode {
    /** Aborts an enqueue transaction to prove that both writes roll back. */
    BookingRefused = "TEST_WORLD_BOOKING_REFUSED",
    /** Restores the scheduler registration and tick after the proof. */
    SchedulerRollback = "TEST_WORLD_SCHEDULER_ROLLBACK",
    /** Fails the first run so redispatch must resume persisted progress. */
    ProviderDown = "TEST_WORLD_PROVIDER_DOWN",
}

/** A coded failure used to exercise rollback and retry behavior. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
