/** Logs nothing and maps nothing. */
export class PlainInterceptor {
    /** Passes the stream through. */
    intercept(_context: unknown, next: { handle(): unknown }): unknown {
        return next.handle()
    }
}
