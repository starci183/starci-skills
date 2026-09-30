import { getEntityManagerToken } from "@nestjs/typeorm"
import type { Provider } from "@nestjs/common"
import { mock } from "@starci/jest-preset/mock"
import type { MockOf } from "@starci/jest-preset/mock"
import { DataSource } from "typeorm"
import type { EntityManager } from "typeorm"

/** A typed EntityManager double: every method is a jest mock, `overrides` replace chosen methods. */
export const mockEntityManager = (overrides: Partial<EntityManager> = {}): MockOf<EntityManager> =>
    mock<EntityManager>(overrides)

/** A `transaction` implementation that runs the unit of work against `inner`, like a transaction that commits. */
export const fakeTransaction = (inner: EntityManager): jest.Mock =>
    jest.fn().mockImplementation((...args: Array<unknown>) => {
        const work = args.find((arg): arg is (manager: EntityManager) => Promise<unknown> => typeof arg === "function")
        return work ? work(inner) : Promise.resolve(undefined)
    })

/** The provider that stands `manager` in for the EntityManager of `connection` in a testing module. */
export const entityManagerProvider = (connection: string, manager: EntityManager): Provider => ({
    provide: getEntityManagerToken(connection),
    useValue: manager,
})

/** A database opened out-of-band by an e2e spec: the manager to read with and the way to close it. */
export interface TestDatabase {
    /** The shared manager of the connection. */
    readonly manager: EntityManager
    /** Closes the connection. */
    close(): Promise<void>
}

/** Opens one database of the run-owned stack for out-of-band verification; the schema is never touched (`synchronize` is false). */
export const openTestDatabase = async (url: string): Promise<TestDatabase> => {
    const dataSource = new DataSource({ type: "postgres", url, synchronize: false })
    await dataSource.initialize()
    return { manager: dataSource.manager, close: () => dataSource.destroy() }
}
