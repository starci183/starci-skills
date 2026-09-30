/** Fixture: the handle `useTestWorld` answers, declared in the test world slot (a file of its own so no spec here is an orphan). */
export declare class TestWorld {
    readonly db: { core: { find(): Promise<unknown[]> } }
    readonly services: { billing: { api: { balance(): Promise<number> } } }
    readonly other: { db: { find(): number } }
    waitFor<T>(label: string, check: () => Promise<T | null | undefined>): Promise<T>
}

/** Fixture: registers the world hooks around a spec. */
export declare function useTestWorld(): TestWorld
