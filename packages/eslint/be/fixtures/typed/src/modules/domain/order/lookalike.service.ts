/** Fixture: lookalike types declared by an ordinary owner, never the platform ports. */
export interface Logger {
    info(event: string): void
}
export interface Inbox {
    claim(source: string, eventId: string): Promise<boolean>
}
export class Secret {
    constructor(readonly value: string) {}
}
export interface Sender {
    send(message: { subject: string; body: string }): Promise<void>
}
