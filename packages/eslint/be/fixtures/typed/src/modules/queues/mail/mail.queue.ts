import type { EntityManager } from "typeorm"
import type { QueueOutbox } from "@modules/platform/queue"

/** The typed producer of the mail queue (fixture): `enqueueMail(payload, tx)` writes the outbox in the caller's transaction. */
export class MailQueue {
    constructor(private readonly outbox: QueueOutbox) {}

    /** Enqueues one mail. */
    enqueueMail(payload: { to: string }, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, "mail", payload)
    }
}
