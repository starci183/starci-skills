import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { AdmitNotificationRequest, AdmitNotificationResult } from "./admit-notification.contracts"

/** Asks to admit one event into the notify pipeline; the admit consumer sends it for every delivered message. */
export class AdmitNotificationCommand extends Command<AdmitNotificationResult> {
    constructor(readonly params: PublicExecuteParams<AdmitNotificationRequest>) {
        super()
    }
}
