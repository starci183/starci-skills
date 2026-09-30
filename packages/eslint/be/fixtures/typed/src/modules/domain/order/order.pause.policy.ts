/** Fixture: a wait written outside platform/retry under an unremarkable name. */
export const hold = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
/** Fixture: a helper that does not wait. */
export const label = (id: string): string => `order:${id}`
export class Napper {
    /** A method that waits. */
    rest(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
