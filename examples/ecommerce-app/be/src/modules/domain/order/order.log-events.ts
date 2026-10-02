/** Log events of the order capability. */
export enum OrderLogEvent {
    /** A payment confirmation named an order that is not pending any more (expired or cancelled before the money arrived); the order id rides in the fields and the order is left unchanged. */
    PaymentForClosedOrder = "order.payment.for_closed_order",
}
