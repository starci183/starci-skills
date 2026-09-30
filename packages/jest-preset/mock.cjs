"use strict"

/**
 * `mock<T>()` -- a typed test double that replaces the `{ ... } as unknown as T` cast.
 *
 * Every property read yields one stable `jest.fn()` (created on first read), so `mock<Repo>().find` is
 * already a mock function, `expect(m.find).toHaveBeenCalledWith(...)` works, and `m.find.mockResolvedValue(x)`
 * type-checks against `Repo["find"]`. Values passed in `overrides` win over the generated functions and may be
 * partial: the return type is still `T`.
 *
 * `createMock` takes the function factory as an argument (called with the property name) so the helper has no hard
 * dependency on a global `jest`; `mock` binds it to `jest.fn`.
 */

// Probed by promise resolution, jest matchers and serializers: they must read as absent, not as a mock function.
const ABSENT = new Set(["then", "asymmetricMatch", "$$typeof", "nodeType", "tagName", "toJSON"])

function createMock(makeFn) {
  return function mock(overrides) {
    const own = new Map()
    const store = overrides ? { ...overrides } : {}
    return new Proxy(store, {
      get(target, property, receiver) {
        if (Object.hasOwn(target, property)) return Reflect.get(target, property, receiver)
        if (typeof property === "symbol" || property in Object.prototype) return Reflect.get(target, property, receiver)
        if (ABSENT.has(property)) return undefined
        if (!own.has(property)) own.set(property, makeFn(property))
        return own.get(property)
      },
      set(target, property, value) {
        own.delete(property)
        target[property] = value
        return true
      },
      has(target, property) {
        return Object.hasOwn(target, property) || own.has(property)
      },
    })
  }
}

// jest-runtime hands every module it loads, this one included, a module-scoped `jest` object; it is not a property
// of globalThis, so it is read as a free identifier. @jest/globals is the fallback for a runner that does not.
function jestFn(implementation) {
  if (typeof jest !== "undefined" && typeof jest.fn === "function") return jest.fn(implementation)
  try {
    return require("@jest/globals").jest.fn(implementation)
  } catch {
    throw new Error("@starci/jest-preset mock<T>() needs the jest runtime; call it from a jest test")
  }
}

module.exports = { mock: createMock(() => jestFn()), createMock, jestFn }
