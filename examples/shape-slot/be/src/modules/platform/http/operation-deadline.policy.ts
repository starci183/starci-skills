/** Bounds how long a request waits for a dependency; the owning capability translates expiry into its public error. */
export const withOperationDeadline = async <T>(operation: Promise<T>, timeoutMs: number): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(reject, timeoutMs)
    })
    try {
        return await Promise.race([operation, deadline])
    } finally {
        clearTimeout(timer)
    }
}
