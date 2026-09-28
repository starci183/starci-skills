/**
 * The one feedback owner every write action settles through (FE-ERROR-1/FE-ERROR-4): a caller never
 * chains its own success/failure handling directly onto a write call, it hands the pending operation here
 * instead, so every write's user-visible feedback has exactly one owner to audit.
 */
export const runWrite = <T>(operation: () => Promise<T>): Promise<T> => {
    return operation()
}
