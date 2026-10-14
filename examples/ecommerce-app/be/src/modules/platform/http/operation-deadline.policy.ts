import { HttpError, HttpErrorCode } from "./errors/http.error"

/** The asynchronous operation whose answer must arrive before the deadline. */
type DeadlineOperation<Result> = () => Promise<Result>

/** Bounds an operation's answer and clears its timer on every settlement; the caller maps an expired deadline. */
export const withinDeadline = async <Result>(
    operation: DeadlineOperation<Result>,
    timeoutMs: number,
): Promise<Result> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<Result>((_resolve, reject) => {
        timer = setTimeout(() => reject(new HttpError({ code: HttpErrorCode.Timeout })), timeoutMs)
    })
    try {
        return await Promise.race([Promise.resolve().then(operation), deadline])
    } finally {
        clearTimeout(timer)
    }
}
