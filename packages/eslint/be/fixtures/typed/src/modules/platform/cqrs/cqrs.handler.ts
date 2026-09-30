/** The template every handler extends. */
export abstract class ICQRSHandler<TMessage, TResult> {
    /** The bus entry point. */
    async execute(message: TMessage): Promise<TResult> {
        return this.process(message)
    }

    /** The decision logic. */
    protected abstract process(message: TMessage): Promise<TResult>
}
