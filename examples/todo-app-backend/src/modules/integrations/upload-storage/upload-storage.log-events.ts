/** Log events of the upload integration and of the handlers that drive its byte plane. */
export enum UploadLogEvent {
    /** The storage plane failed to put, read or delete an object; the failure is the cause. */
    StorageFailed = "upload.storage.failed",
}
