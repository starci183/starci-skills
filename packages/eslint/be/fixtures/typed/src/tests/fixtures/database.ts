import type { EntityManager } from "typeorm"

/** Fixture: the one typed EntityManager fake of unit specs. */
export declare function mockEntityManager(rows?: Record<string, Array<object>>): EntityManager

/** Fixture: a transaction fake bound to a manager fake. */
export declare function fakeTransaction(manager: EntityManager): EntityManager
