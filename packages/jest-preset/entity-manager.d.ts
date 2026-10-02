/// <reference types="jest" />
import type { DeleteResult, EntityManager, InsertResult, UpdateResult } from "typeorm"
import type { MockOf } from "./mock"

/** A typed double of `EntityManager`: assignable wherever an `EntityManager` is required, every method a jest mock. */
export type MockEntityManager = MockOf<EntityManager>

/** An entity class. */
export type EntityClass<E extends object = object> = new (...args: never[]) => E

type Row<C extends EntityClass> = InstanceType<C>
type Write<T> = Partial<Omit<T, "raw">> & { readonly raw?: unknown }

/** The result type of each entity-taking `EntityManager` method, for the entity class `C`. */
export interface EntityAnswers<C extends EntityClass> {
  findOne: Row<C> | null
  findOneBy: Row<C> | null
  findOneOrFail: Row<C>
  findOneByOrFail: Row<C>
  find: ReadonlyArray<Row<C>>
  findBy: ReadonlyArray<Row<C>>
  findAndCount: readonly [ReadonlyArray<Row<C>>, number]
  findAndCountBy: readonly [ReadonlyArray<Row<C>>, number]
  count: number
  countBy: number
  exists: boolean
  existsBy: boolean
  save: Row<C> | ReadonlyArray<Row<C>>
  remove: Row<C> | ReadonlyArray<Row<C>>
  softRemove: Row<C> | ReadonlyArray<Row<C>>
  recover: Row<C> | ReadonlyArray<Row<C>>
  insert: Write<InsertResult>
  update: Write<UpdateResult>
  upsert: Write<InsertResult>
  delete: Write<DeleteResult>
  softDelete: Write<UpdateResult>
  restore: Write<UpdateResult>
  increment: Write<UpdateResult>
  decrement: Write<UpdateResult>
}

/** The methods a spec may stub as `[Entity, result]`. */
export type EntityMethod = keyof EntityAnswers<EntityClass>

type Pair<M extends EntityMethod, C extends EntityClass> = readonly [entity: C, result: EntityAnswers<C>[M]]
type Untyped = readonly [unknown, unknown]

/** One stub: `[Entity, result]` (`query`: `[sql, rows]`), or a list of such pairs answered in order. */
export type StubOf<M extends string, V> = M extends "query"
  ? readonly [sql: string, rows: unknown] | ReadonlyArray<readonly [sql: string, rows: unknown]>
  : M extends EntityMethod
    ? V extends readonly [infer C extends EntityClass, unknown]
      ? Pair<M, C>
      : V extends ReadonlyArray<readonly [infer C extends EntityClass, unknown]>
        ? ReadonlyArray<Pair<M, C>>
        : never
    : never

/** The stubs of a spec, checked entry by entry against the entity each one names. */
export type StubsOf<S> = { readonly [M in keyof S & string]: StubOf<M, S[M]> }

/**
 * A strict `EntityManager` double. Describe what the subject should see, `{ findOne: [OrderEntity, order] }`; any method
 * the subject calls that the spec did not stub throws an error naming the method, and a wrong entity or sql text throws
 * too. Results are typed against the entity: `findOne: [OrderEntity, 5]` is a compile error.
 */
export declare function mockEntityManager<
  const S extends { readonly [M in string]?: Untyped | ReadonlyArray<Untyped> } = Record<never, never>,
>(stubs?: S & StubsOf<S>): MockEntityManager

/** A write made inside a transaction. */
export interface TransactionWrite {
  readonly method: string
  readonly args: ReadonlyArray<unknown>
}

/** The transaction attached to a double by `fakeTransaction`. */
export interface FakeTransaction<M extends MockEntityManager = MockEntityManager> {
  /** The double whose `transaction(work)` runs `work`. */
  readonly em: M
  /** How each transaction ended, in call order. */
  readonly outcomes: ReadonlyArray<"commit" | "rollback" | "pending">
  /** Number of transactions that committed. */
  readonly commits: number
  /** Number of transactions that rolled back (the callback threw; the error was rethrown). */
  readonly rollbacks: number
  /** The writes of the transactions that committed. */
  readonly committedWrites: ReadonlyArray<TransactionWrite>
  /** The writes of the transactions that rolled back: what a real rollback would have discarded. */
  readonly rolledBackWrites: ReadonlyArray<TransactionWrite>
}

/** Makes `em.transaction(work)` run `work` with a scoped view of the double and record commit, rollback and writes. */
export declare function fakeTransaction<M extends MockEntityManager = MockEntityManager>(em?: M): FakeTransaction<M>

/** Whether `manager` is the view a `fakeTransaction` body received (used by `recordingEventBus` and `recordingQueueOutbox`). */
export declare function isTransactionManager(manager: unknown): boolean

/** The kit over a function factory, for callers that bring their own (used by the package spec). */
export declare function createEntityManagerKit(makeFn: (implementation?: (...args: never[]) => unknown) => unknown): {
  mockEntityManager: typeof mockEntityManager
  fakeTransaction: typeof fakeTransaction
}
