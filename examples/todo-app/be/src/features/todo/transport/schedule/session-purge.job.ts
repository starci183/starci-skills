import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { ScheduledJob } from "@modules/platform/scheduling"
import { PurgeLapsedSessionsCommand } from "../../application/purge-lapsed-sessions.command"

/** How often lapsed sessions are swept: hourly. */
const PURGE_EVERY_MS = 3_600_000

@Injectable()
/** Sweeps the sessions that lapsed; expiry is enforced on read, so a late tick never keeps a session alive. */
export class SessionPurgeJob implements ScheduledJob {
    /** The job name, also the name of its lease. */
    readonly name = "session.purge"

    /** Once an hour. */
    readonly schedule = { everyMs: PURGE_EVERY_MS }

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches the purge for the tick at `at`. */
    async run(at: Date): Promise<void> {
        await this.commandBus.execute(new PurgeLapsedSessionsCommand({ request: { at } }))
    }
}
