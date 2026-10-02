"use strict"

/**
 * `mockEntityManager()` and `fakeTransaction()` -- the one typed double of a typeorm `EntityManager`.
 *
 * `mockEntityManager(stubs)` takes the answers a spec describes as `{ method: [Entity, result] }` (`query` takes
 * `[sql, rows]`; several answers of one method are a list of pairs). Every method is a `jest.fn()`, so
 * `expect(em.save).toHaveBeenCalledWith(...)` works, and a method the subject calls that the spec did NOT stub throws
 * `mockEntityManager: em.<method>() was called but this spec did not stub it`. The absence of a stub is therefore the
 * proof that the subject made no such call. A method stubbed for another entity (or another sql text) throws too and names
 * both. Answers of one method and one entity are handed out in order and the last one repeats. There is no typeorm import
 * here: the types come from `entity-manager.d.ts` (type-only), the runtime is a Proxy.
 *
 * `create(Entity, plain)` is pure construction and works without a stub. `transaction` needs `fakeTransaction`.
 *
 * `fakeTransaction(em)` makes `em.transaction(work)` (and `em.transaction(isolation, work)`) run `work` with a scoped view
 * of the same double and record how it ended (`commit` when `work` resolves, `rollback` when it throws and the error is
 * rethrown) and which writes it made, so a spec can assert that a rolled-back transaction committed nothing.
 */
const { createMock, jestFn } = require("./mock.cjs")

/** The manager views handed to a transaction body; `recordingEventBus` and `recordingQueueOutbox` ask whether a manager is one of them. */
const TRANSACTION_MANAGERS = new WeakSet()

/** Methods that change data; a write made inside a transaction is recorded on it. */
const WRITE_METHODS = new Set([
  "save", "insert", "update", "delete", "remove", "softRemove", "softDelete", "recover", "restore", "upsert",
  "increment", "decrement", "clear",
])
const WRITE_SQL = /^\s*(insert|update|delete|upsert|merge|truncate)\b/i

const describeTarget = (target) => (typeof target === "function" ? target.name || "<anonymous class>" : JSON.stringify(String(target)).slice(0, 80))

const isPair = (value) => Array.isArray(value) && value.length === 2 && (typeof value[0] === "function" || typeof value[0] === "string")

/** `{ method: [target, result] | [[target, result], ...] }` as `Map<method, Array<{ target, result, used }>>`. */
function tableOf(stubs) {
  const table = new Map()
  for (const [method, value] of Object.entries(stubs)) {
    const pairs = isPair(value) ? [value] : value
    if (!Array.isArray(pairs) || !pairs.every(isPair)) {
      throw new Error(`mockEntityManager: the stub of em.${method}() must be [Entity, result] (em.query: [sql, rows]) or a list of such pairs`)
    }
    table.set(method, pairs.map(([target, result]) => ({ target, result, used: false })))
  }
  return table
}

/**
 * The kit over a function factory (`makeFn(implementation)`); `mockEntityManager` and `fakeTransaction` below bind it to
 * `jest.fn`. The seam lets the package spec run the kit without a jest runtime.
 */
function createEntityManagerKit(makeFn) {
  function answerOf(method, entries) {
    if (entries === undefined) {
      return () => {
        throw new Error(
          `mockEntityManager: em.${method}() was called but this spec did not stub it. Stub it with mockEntityManager({ ${method}: [Entity, result] }); an unstubbed call means the subject reached the database where the spec says it must not.`,
        )
      }
    }
    return async (...args) => {
      const matches = entries.filter((entry) => entry.target === args[0])
      if (matches.length === 0) {
        throw new Error(
          `mockEntityManager: em.${method}(${describeTarget(args[0])}) was called but this spec stubbed em.${method} only for ${entries.map((entry) => describeTarget(entry.target)).join(", ")}`,
        )
      }
      const entry = matches.find((candidate) => !candidate.used) ?? matches[matches.length - 1]
      entry.used = true
      return entry.result
    }
  }

  /** @param {Record<string, unknown>} [stubs] */
  function mockEntityManager(stubs = {}) {
    const table = tableOf(stubs)
    const create = makeFn((target, plain) => Object.assign(new target(), plain))
    return createMock((method) => makeFn(answerOf(method, table.get(method))))({ create })
  }

  /** @param {object} [em] - The double to attach the transaction to; a fresh `mockEntityManager()` by default. */
  function fakeTransaction(em = mockEntityManager()) {
    const runs = []
    const scopedFor = (run) => {
      const view = new Proxy(em, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver)
          if (property === "transaction") return (...args) => args[args.length - 1](view)
          if (typeof property !== "string" || typeof value !== "function") return value
          if (!WRITE_METHODS.has(property) && property !== "query") return value
          return (...args) => {
            if (property !== "query" || WRITE_SQL.test(String(args[0]))) run.writes.push({ method: property, args })
            return value(...args)
          }
        },
      })
      TRANSACTION_MANAGERS.add(view)
      return view
    }
    em.transaction = makeFn(async (...args) => {
      const work = args[args.length - 1]
      if (typeof work !== "function") throw new Error("fakeTransaction: em.transaction() needs a callback as its last argument")
      const run = { outcome: "pending", writes: [] }
      runs.push(run)
      try {
        const result = await work(scopedFor(run))
        run.outcome = "commit"
        return result
      } catch (error) {
        run.outcome = "rollback"
        throw error
      }
    })
    const writesOf = (outcome) => runs.filter((run) => run.outcome === outcome).flatMap((run) => run.writes)
    return {
      em,
      /** How each transaction ended, in call order: "commit" or "rollback". */
      get outcomes() {
        return runs.map((run) => run.outcome)
      },
      get commits() {
        return runs.filter((run) => run.outcome === "commit").length
      },
      get rollbacks() {
        return runs.filter((run) => run.outcome === "rollback").length
      },
      /** The writes (`{ method, args }`) that ended in a commit, in call order. */
      get committedWrites() {
        return writesOf("commit")
      },
      /** The writes that a rollback discarded: made by a body that then threw. */
      get rolledBackWrites() {
        return writesOf("rollback")
      },
    }
  }

  return { mockEntityManager, fakeTransaction }
}

/** Whether `manager` is the scoped view a `fakeTransaction` body received. */
const isTransactionManager = (manager) => typeof manager === "object" && manager !== null && TRANSACTION_MANAGERS.has(manager)

module.exports = { ...createEntityManagerKit(jestFn), createEntityManagerKit, isTransactionManager }
