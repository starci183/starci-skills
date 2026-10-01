/** Log events of the receipt storage integration. */
export enum ReceiptStorageLogEvent {
    /** A store call failed; the key and the reason ride in the fields, the failure is the cause. */
    StoreFailed = "receipt_storage.store.failed",
}
