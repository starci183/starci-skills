/** What a pass loop runs and how it paces itself. */
export interface PassLoopParams {
    /** One pass of the work; it answers how many items it handled. */
    readonly pass: () => Promise<number>
    /** Reports a pass that threw; the loop goes on and counts that pass as idle. */
    readonly onFailure: (cause: unknown) => void
    /** Pauses the loop for the given milliseconds. */
    readonly wait: (ms: number) => Promise<void>
    /** The pause after an idle pass, in milliseconds. */
    readonly idleMs: number
}

/** A loop that runs passes from `start` to `stop` and pauses only after a pass that handled nothing. */
export class PassLoop {
    private running = false
    private loop: Promise<void> = Promise.resolve()

    constructor(private readonly params: PassLoopParams) {}

    /** Starts the loop. */
    start(): void {
        this.running = true
        this.loop = this.run()
    }

    /** Stops the loop and waits for its last pass. */
    async stop(): Promise<void> {
        this.running = false
        await this.loop
    }

    private async run(): Promise<void> {
        while (this.running) {
            const handled = await this.params.pass().catch((cause: unknown) => {
                this.params.onFailure(cause)
                return 0
            })
            if (handled === 0 && this.running) await this.params.wait(this.params.idleMs)
        }
    }
}
