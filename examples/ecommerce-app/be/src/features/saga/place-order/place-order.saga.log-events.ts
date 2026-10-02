/** Log events of the place-order saga. */
export enum PlaceOrderSagaLogEvent {
    /** The saga compensates a step after the event that reports its failure; the step and its event ride in the fields. */
    Compensating = "saga.place-order.compensating",
}
