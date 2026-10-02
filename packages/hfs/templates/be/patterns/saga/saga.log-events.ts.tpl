/** Log events of the @@saga@@ saga. */
export enum @@Saga@@SagaLogEvent {
    /** The saga compensates a step after the event that reports its failure; the step and its event ride in the fields. */
    Compensating = "saga.@@saga@@.compensating",
}
