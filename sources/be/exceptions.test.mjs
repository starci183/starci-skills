/**
 * Twin tests for the exception rules.
 *
 *   node --test exceptions.test.mjs
 *
 * The cases worth writing here are the two halves catching what the other misses: a framework base
 * hidden behind a house NAME (which the throw-site rule cannot see) and a bare `Error` (which the
 * declaration rule cannot see). A suite that only tested the obvious direction would pass while the
 * pairing was broken.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  exceptionExtendsAbstract,
  exceptionInErrorsFolder,
  requireExceptionObjectArg,
  rules,
  throwAbstractException,
} from "./exceptions.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

const ERRORS = "D:/repo/src/modules/platform/exceptions/errors/courses/course-not-found.ts"
const BASE = "D:/repo/src/modules/platform/exceptions/errors/abstract.ts"
const HANDLER = "D:/repo/src/features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("EXCEPTION-1: a bare Error and a framework exception are both refused", () => {
  tester.run("throw-abstract-exception", throwAbstractException, {
    valid: [
      "throw new CourseNotFoundException({ id })",
      "throw new AbstractException({})",
      // rethrowing something already caught is not constructing a failure
      "try { run() } catch (error) { throw error }",
      // constructing an Error without throwing it is a different thing
      "const e = new Error('x')",
    ],
    invalid: [
      { code: "throw new Error('course not found')", errors: [{ messageId: "bareError" }] },
      { code: "throw new BadRequestException('nope')", errors: [{ messageId: "framework" }] },
      { code: "throw new ConflictException()", errors: [{ messageId: "framework" }] },
    ],
  })
})

test("EXCEPTION-2: the constructor takes exactly one metadata object", () => {
  tester.run("require-exception-object-arg", requireExceptionObjectArg, {
    valid: [
      "throw new CourseNotFoundException({ id })",
      "throw new UserNotFoundException({})",
      // the base itself is exempt, and non-exception classes are not this rule's business
      "throw new AbstractException()",
      "throw new SomeOtherThing('positional')",
    ],
    invalid: [
      { code: "throw new UserNotFoundException()", errors: [{ messageId: "zero" }] },
      { code: "throw new CourseNotFoundException(courseId)", errors: [{ messageId: "notObject" }] },
      {
        code: "throw new CourseNotFoundException({ id }, 'extra')",
        errors: [{ messageId: "extra" }],
      },
    ],
  })
})

test("EXCEPTION-3: a framework base hidden behind a house name is caught at the declaration", () => {
  tester.run("exception-extends-abstract", exceptionExtendsAbstract, {
    valid: [
      { filename: ERRORS, code: "export class CourseNotFoundException extends AbstractException {}" },
      // the base's own file is the one class allowed to extend something else
      { filename: BASE, code: "export class AbstractException extends Error {}" },
      // not an exception by name
      { filename: ERRORS, code: "export class CourseLookup extends BaseLookup {}" },
    ],
    invalid: [
      {
        filename: ERRORS,
        code: "export class CourseAlreadyEnrolledException extends ConflictException {}",
        errors: [{ messageId: "base" }],
      },
    ],
  })
})

test("EXCEPTION-4: exceptions are declared in one folder", () => {
  tester.run("exception-in-errors-folder", exceptionInErrorsFolder, {
    valid: [
      { filename: ERRORS, code: "export class CourseNotFoundException extends AbstractException {}" },
      // a class named like an exception but extending nothing is a shape, not a failure
      { filename: HANDLER, code: "class LocalException {}" },
      { filename: HANDLER, code: "export class AddToCartHandler extends ICQRSHandler {}" },
    ],
    invalid: [
      {
        filename: HANDLER,
        code: "export class CartFullException extends AbstractException {}",
        errors: [{ messageId: "place" }],
      },
    ],
  })
})
