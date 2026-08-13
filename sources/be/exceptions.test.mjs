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
      /*
       * THE TEST LANES, WHICH CANON EXCUSES IN PROSE AND THIS RULE NOW EXCUSES IN CODE.
       *
       * These cases exist because the exemption was granted in `CLAUDE.md` and missing from the
       * rule, so a repository adopting it inherited findings its own canon had already forgiven -
       * 69 of them in one back end. An exemption nothing asserts is an exemption the next edit
       * removes without noticing.
       */
      {
        filename: "/repo/src/features/billing/charge.spec.ts",
        code: "throw new Error('fixture missing')",
      },
      {
        filename: "/repo/src/tests/e2e/nivo/instance-provision.e2e-spec.ts",
        code: "throw new Error('seed missing: nivo-ai-agent/agent_basic')",
      },
      {
        filename: "/repo/src/tests/helpers/flow-world.ts",
        code: "throw new Error('the gateway webhook was refused')",
      },
      /*
       * A PROBE, WHERE THE STATUS CODE IS THE WHOLE CONTRACT.
       *
       * The rule refuses a framework exception because it "carries an HTTP status and no identity".
       * On a readiness probe that sentence inverts: kubernetes reads the status and never the body,
       * so the status IS the identity - and a domain exception would arrive as a 500 and be read as
       * "down" for a reason that has nothing to do with readiness.
       */
      {
        filename: "/repo/apps/controlplane/src/health/healthz.controller.ts",
        code: "throw new ServiceUnavailableException(body)",
      },
      {
        filename: "/repo/src/modules/health/health.controller.ts",
        code: "throw new ServiceUnavailableException({ ready: false })",
      },
    ],
    invalid: [
      { code: "throw new Error('course not found')", errors: [{ messageId: "bareError" }] },
      // still refused inside a probe: a status code is a contract, an unnamed crash is not
      {
        filename: "/repo/src/modules/health/health.controller.ts",
        code: "throw new Error('probe blew up')",
        errors: [{ messageId: "bareError" }],
      },
      { code: "throw new BadRequestException('nope')", errors: [{ messageId: "framework" }] },
      { code: "throw new ConflictException()", errors: [{ messageId: "framework" }] },
      // the probe exemption stays narrow: a service in a health-adjacent feature is not a probe
      {
        filename: "/repo/src/modules/billing/health-report.service.ts",
        code: "throw new ServiceUnavailableException('nope')",
        errors: [{ messageId: "framework" }],
      },
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
      /*
       * ANY exceptions folder, not one repository's path.
       *
       * The rule used to require `/platform/exceptions/errors/`, which was one layout written into
       * a law. EXCEPTION-4 asks for one place per APPLICATION to look, and a repository with
       * several apps satisfies that with one folder each - a fact measured the hard way, when the
       * narrow path reported 83 findings in a second back end whose top offenders were already
       * sitting in an `exceptions/errors/` folder.
       */
      {
        filename: "/repo/apps/agentos-cli/src/exceptions/errors/provision-failed.ts",
        code: "export class ProvisionFailedException extends AbstractException {}",
      },
      {
        filename: "/repo/src/modules/expert/exceptions/errors/affiliate/affiliate-not-found.ts",
        code: "export class AffiliateNotFoundException extends AbstractException {}",
      },
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
