import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { NotificationPreferencesRequest, NotificationPreferencesResult } from "./notification-preferences.contracts"

/** Asks for the caller's notification preferences on one channel. */
export class NotificationPreferencesQuery extends Query<NotificationPreferencesResult> {
    constructor(readonly params: ExecuteParams<NotificationPreferencesRequest>) {
        super()
    }
}
