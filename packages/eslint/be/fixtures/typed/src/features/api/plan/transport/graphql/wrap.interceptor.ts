import { map } from "rxjs"

/** Wraps every answer in an envelope. */
export class WrapInterceptor {
    /** Maps the handled stream. */
    intercept(_context: unknown, next: { handle(): { pipe(op: unknown): unknown } }): unknown {
        return next.handle().pipe(map((data: unknown) => ({ data })))
    }
}
