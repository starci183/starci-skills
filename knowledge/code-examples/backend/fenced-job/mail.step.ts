// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { Injectable } from "@nestjs/common"
//   import { InjectMailer } from "@modules/integrations/mailer"
//   import type { Mailer } from "@modules/integrations/mailer"
//   import { InjectJobClaims } from "@modules/platform/jobs"
//   import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** One external effect of the job: the receipt mail. */
export class MailStep implements JobStep {
    constructor(
        @InjectMailer() private readonly mailer: Mailer,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Sends the mail with the run key of this claim, then records the step with the token this worker holds. */
    async run(job: ClaimedJob): Promise<void> {
        // The key includes the fencing token: a zombie that repeats this call is dropped by the provider.
        await this.mailer.sendReceipt({ jobId: job.jobId }, this.claims.runKey(job, "send"))
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "send" })
    }
}
