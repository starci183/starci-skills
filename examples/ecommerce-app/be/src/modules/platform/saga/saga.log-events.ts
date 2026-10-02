/** Log events of the saga state machine. */
export enum SagaLogEvent {
    /** A run compensates a step after the event that reports its failure; the saga, the run, the step and its event ride in the fields. */
    Compensating = "saga.compensating",
}
