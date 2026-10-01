import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { PurgeLapsedSessionsRequest, PurgeLapsedSessionsResult } from "./purge-lapsed-sessions.contracts"

/** Asks to delete the sessions that have lapsed; a system command sent by the session purge job. */
export class PurgeLapsedSessionsCommand extends Command<PurgeLapsedSessionsResult> {
    constructor(readonly params: PublicExecuteParams<PurgeLapsedSessionsRequest>) {
        super()
    }
}
