/** Fixture: an application handler, the kind of actor an e2e never calls directly. */
export class StartCheckoutHandler {
    handle(): Promise<void> {
        return Promise.resolve()
    }
}
