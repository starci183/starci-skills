/** Fixture: an outbound provider client. */
export declare class MailerClient {
    send(message: { subject: string; body: string }): Promise<void>
}
