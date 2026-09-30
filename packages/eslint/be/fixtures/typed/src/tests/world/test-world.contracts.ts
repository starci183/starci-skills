/** Fixture: the handle `useTestWorld` answers, declared in the test world slot (a file of its own so no spec here is an orphan). */
export declare class TestWorld {
    waitFor<T>(label: string, check: () => Promise<T | null | undefined>): Promise<T>
}

/** Fixture: registers the world hooks around a spec. */
export declare function useTestWorld(): TestWorld
