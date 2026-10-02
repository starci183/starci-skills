/** Log events of the order capability. */
export enum OrderLogEvent {
    /** A receipt could not be archived; the order id rides in the fields and the failure is the cause. It is archived on the buyer's first request. */
    ReceiptArchiveFailed = "order.receipt.archive_failed",
    /** `order.placed` could not be published; the order id rides in the fields and the failure is the cause. A replayed confirmation announces it again. */
    EventPublishFailed = "order.message.publish_failed",
}
