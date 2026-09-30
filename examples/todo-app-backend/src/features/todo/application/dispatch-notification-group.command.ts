import { Command } from "@nestjs/cqrs"
import type { DispatchNotificationGroupResult } from "@modules/domain/notify"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { DispatchNotificationGroupRequest } from "./dispatch-notification-group.contracts"

/** Asks to send one digest group as one message; the dispatch consumer sends it for the delayed flush and for every retry. */
export class DispatchNotificationGroupCommand extends Command<DispatchNotificationGroupResult> {
    constructor(readonly params: PublicExecuteParams<DispatchNotificationGroupRequest>) {
        super()
    }
}
