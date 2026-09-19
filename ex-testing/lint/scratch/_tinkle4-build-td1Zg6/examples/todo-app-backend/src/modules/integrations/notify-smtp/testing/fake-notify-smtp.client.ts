import {
    NotifySmtpPermanentRejectionException 
} from "@modules/shared/exceptions/errors/notify/notify-smtp-permanent-rejection"
import {
    NotifySmtpTransientFailureException 
} from "@modules/shared/exceptions/errors/notify/notify-smtp-transient-failure"

import {
    NotifySmtpMessage, NotifySmtpPort 
} from "../notify-smtp.contracts"

/** An in-process fake for `NotifySmtpPort`, used by every notify spec instead of a real socket. Records
 * every accepted message and can be told, per address, to answer with a transient failure or a permanent
 * rejection instead - the same shape `createFakeEntityManager` gives persistence specs. */
export class FakeNotifySmtpClient extends NotifySmtpPort {
    readonly sent: Array<NotifySmtpMessage> = []
    private readonly transientFor = new Set<string>()
    private readonly permanentFor = new Set<string>()

    failTransientFor(address: string): void {
        this.transientFor.add(address)
    }

    failPermanentFor(address: string): void {
        this.permanentFor.add(address)
    }

    /** Test-only: stop failing an address, so a later send from the same spec reaches the transport. */
    clearFailuresFor(address: string): void {
        this.transientFor.delete(address)
        this.permanentFor.delete(address)
    }

    async send(message: NotifySmtpMessage): Promise<void> {
        if (this.permanentFor.has(message.to)) {
            throw new NotifySmtpPermanentRejectionException({
                reason: "fake: permanently rejected" 
            })
        }
        if (this.transientFor.has(message.to)) {
            throw new NotifySmtpTransientFailureException({
                reason: "fake: transient failure" 
            })
        }
        this.sent.push(message)
    }
}
