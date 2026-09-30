/** The log events of the notify capability. */
export enum NotifyLogEvent {
    /** The mail host permanently rejected the recipient of a dispatch. */
    SendRejected = "notify.send.rejected",
    /** A send to the mail host failed and will be retried while the budget lasts. */
    SendFailed = "notify.send.failed",
}
