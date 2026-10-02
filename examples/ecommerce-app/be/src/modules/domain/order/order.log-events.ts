/** Log events of the order capability. */
export enum OrderLogEvent {
    /** A receipt could not be archived; the order id rides in the fields and the failure is the cause. It is archived on the buyer's first request. */
    ReceiptArchiveFailed = "order.receipt.archive_failed",
    /** A payment confirmation named an order that is not pending any more (expired or cancelled before the money arrived); the order id rides in the fields and the order is left unchanged. */
    PaymentForClosedOrder = "order.payment.for_closed_order",
    /** `order.placed` could not be published; the order id rides in the fields and the failure is the cause. A replayed confirmation announces it again. */
    EventPublishFailed = "order.message.publish_failed",
}
