// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { Injectable } from "@nestjs/common"
//   import type { ClaimedJob } from "@modules/platform/jobs"
//   import { FencedProcessor } from "@modules/platform/jobs"
//   import { MailStep } from "./steps/mail.step"

@Injectable()
/** The processor of the send-receipt job: the base class claims and settles, `process` runs the steps in order. */
export class SendReceiptProcessor extends FencedProcessor {
    constructor(private readonly mailStep: MailStep) {
        super()
    }

    /** Runs the one external effect; a stale token throws `JobFencedOut` from a guarded write and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.mailStep.run(job)
    }
}
