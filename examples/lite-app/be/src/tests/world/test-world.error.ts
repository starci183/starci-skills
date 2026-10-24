import { DomainError } from "@modules/platform/errors"

/** Infrastructure failures and deliberate failures injected by the integration proofs. */
export enum TestWorldErrorCode {
    /** The local CLI returned malformed scheduler output. */
    SchedulerResponseInvalid = "TEST_WORLD_SCHEDULER_RESPONSE_INVALID",
    /** Aborts an enqueue transaction to prove that both writes roll back. */
    BookingRefused = "TEST_WORLD_BOOKING_REFUSED",
    /** Restores the scheduler registration and tick after the proof. */
    SchedulerRollback = "TEST_WORLD_SCHEDULER_ROLLBACK",
    /** Fails the first run so redispatch must resume persisted progress. */
    ProviderDown = "TEST_WORLD_PROVIDER_DOWN",
    /** The event stream ended before the awaited text arrived. */
    StreamEnded = "TEST_WORLD_STREAM_ENDED",
    /** A polled condition never held within its attempts. */
    ConditionNeverHeld = "TEST_WORLD_CONDITION_NEVER_HELD",
}

/** A coded infrastructure failure or an injected rollback and retry failure. */
export class TestWorldError extends DomainError<TestWorldErrorCode> {}
