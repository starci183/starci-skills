import { mock } from "@starci/jest-preset/mock"
import type { MockOf } from "@starci/jest-preset/mock"
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
