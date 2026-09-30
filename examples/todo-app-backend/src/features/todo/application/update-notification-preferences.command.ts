import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type {
    UpdateNotificationPreferencesRequest,
    UpdateNotificationPreferencesResult,
} from "./update-notification-preferences.contracts"

/** Asks to change the caller's notification preferences on one channel. */
export class UpdateNotificationPreferencesCommand extends Command<UpdateNotificationPreferencesResult> {
    constructor(readonly params: ExecuteParams<UpdateNotificationPreferencesRequest>) {
        super()
    }
}
