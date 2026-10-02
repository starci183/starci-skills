import type { RunKey } from "@modules/platform/jobs"

/** Fixture: an outbound mail provider whose send is idempotent on a run key. */
export declare class MailGateway {
    send(to: string, key: RunKey): Promise<void>
    status(id: string): Promise<string>
}
