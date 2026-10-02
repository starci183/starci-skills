import type { EntityManager } from "typeorm"

/** Where a saga stands: running its steps, compensating after a failure, or settled (completed, or compensated). */
export type SagaStatus = "running" | "compensating" | "compensated" | "completed"

/** What one transition of a saga did: `applied` ran, `duplicate` is a redelivery of an event already taken, `ignored` found no saga to move or one already settled. */
export type SagaTransition = "applied" | "duplicate" | "ignored"

/** What starting a saga needs; the write joins the caller transaction, so the saga exists exactly when the first step committed. */
export interface BeginSagaParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The saga, `<name>` of its `<name>.saga.ts`. */
    readonly saga: string
    /** What the saga is about: the id of the thing it orchestrates (an order id). */
    readonly correlationId: string
}

/** One run of a saga: which saga, and what it is about. */
export interface SagaRun {
    /** The saga. */
    readonly saga: string
    /** What the saga is about. */
    readonly correlationId: string
}

/** The step of a saga a compensation undoes, as the `Compensating` log names it: its name and the event it puts on the wire. */
export interface SagaStepRef {
    /** The name of the step. */
    readonly name: string
    /** The event the step puts on the wire. */
    readonly event: string
}

/** The compensation of one step: the run that undoes it. */
export interface SagaCompensation {
    /** Undoes the step for the run of the correlation id; it runs once per run, resumed after a crash. */
    run(correlationId: string): Promise<void>
}

/** What compensating a saga needs. */
export interface CompensateSagaParams extends SagaRun {
    /** The id of the delivered event that reports the failure; a redelivery of it changes nothing. */
    readonly eventId: string
    /** The step whose failure this event reports, named in the log of the compensation. */
    readonly step: SagaStepRef
    /** The compensation that undoes the completed steps, in reverse order. */
    readonly compensation: SagaCompensation
}

/** What completing a saga needs. */
export interface CompleteSagaParams extends SagaRun {
    /** The id of the delivered event that reports the last step done; a redelivery of it changes nothing. */
    readonly eventId: string
}

/** The persisted state of a saga run, or null when the run does not exist. */
export type FindSagaResult = SagaState | null

/** The persisted state of one saga as the store reads it. */
export interface SagaState {
    /** What the run is about: the id of the thing it orchestrates (an order id). */
    readonly correlationId: string
    /** The status. */
    readonly status: SagaStatus
    /** The fence: every transition moves it by one and names the version it read, so two transitions never both win. */
    readonly version: number
}
