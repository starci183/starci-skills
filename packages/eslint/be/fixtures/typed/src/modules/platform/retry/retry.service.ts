/** Fixture: the shared retry helper and the one wait that may live beside it. */
export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
export const retry = async <T>(work: () => Promise<T>): Promise<T> => work()
