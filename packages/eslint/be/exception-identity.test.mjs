/**
 * Twin tests for the exception identity rules.
 *
 *   node --test exception-identity.test.mjs
 *
 * The cases worth writing here are the ones the neighbouring law cannot see. `exceptions.mjs` guards
 * the base class, the throw site and the folder, and every one of those rules matches on a name
 * ending in `Exception` - so the case that matters most is a correctly based, correctly placed,
 * correctly thrown failure called `SomethingError`, which passes all four and is checked by none.
 *
 * The second cluster is the copied code, because that is how the one duplicate in the reference back
 * end arrived: an exception written beside another, with the line naming it left as it was found.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  exceptionCodeMatchesClassName,
  exceptionMetadataTypeNamedForClass,
  exceptionNameEndsInException,
  rules,
} from "./exception-identity.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("IDENTITY-1: a failure named Error extends the house base and is checked by nothing", () => {
  tester.run("exception-name-ends-in-exception", exceptionNameEndsInException, {
    valid: [
      "export class CourseNotFoundException extends AbstractException {}",
      // the base's own declaration extends `Error` and is not a failure of its own
      "export class AbstractException extends Error {}",
      // a class that is not an exception is not this rule's business, whatever it is called
      "export class CourseSeedError extends Error {}",
      "export class CourseService {}",
    ],
    invalid: [
      {
        code: "export class CourseAlreadyEnrolledError extends AbstractException {}",
        errors: [{ messageId: "suffix" }],
      },
      {
        // the suffix is missing entirely, which reads even more like a plain shape
        code: "export class ContentContextNotFound extends AbstractException {}",
        errors: [{ messageId: "suffix" }],
      },
    ],
  })
})

test("IDENTITY-2: the code is the class name, and a copied one is refused", () => {
  tester.run("exception-code-matches-class-name", exceptionCodeMatchesClassName, {
    valid: [
      `export class CourseNotFoundException extends AbstractException {
         constructor({ id }: CourseNotFoundExceptionMetadata) {
           super("Course not found", "COURSE_NOT_FOUND_EXCEPTION", { id })
         }
       }`,
      // an acronym has no single correct split, so underscore placement is not the ruling
      `export class GraphQLDataNotFoundException extends AbstractException {
         constructor({ id }: GraphQLDataNotFoundExceptionMetadata) {
           super("Not found", "GRAPHQL_DATA_NOT_FOUND_EXCEPTION", { id })
         }
       }`,
      // no constructor of its own, so there is no code here to disagree with anything
      "export class CourseNotFoundException extends AbstractException {}",
    ],
    invalid: [
      {
        // the real duplicate: an OTP challenge reporting the course challenge's code
        code: `export class ChallengeOtpNotFoundException extends AbstractException {
                 constructor({ id }: ChallengeOtpNotFoundExceptionMetadata) {
                   super("Challenge not found", "CHALLENGE_NOT_FOUND_EXCEPTION", { id })
                 }
               }`,
        errors: [{ messageId: "mismatch" }],
      },
      {
        // the class was renamed and the wire identity was left behind
        code: `export class CoursePathNameNotFoundException extends AbstractException {
                 constructor({ id }: CoursePathNameNotFoundExceptionMetadata) {
                   super("Not found", "COURSE_DIR_NAME_NOT_FOUND_EXCEPTION", { id })
                 }
               }`,
        errors: [{ messageId: "mismatch" }],
      },
      {
        code: `export class CourseNotFoundException extends AbstractException {
                 constructor({ id }: CourseNotFoundExceptionMetadata) {
                   super("Course not found", \`COURSE_\${scope}_NOT_FOUND\`, { id })
                 }
               }`,
        errors: [{ messageId: "notLiteral" }],
      },
    ],
  })
})

test("IDENTITY-3: the metadata type carries the exception's own name", () => {
  tester.run("exception-metadata-type-named-for-class", exceptionMetadataTypeNamedForClass, {
    valid: [
      `export class CourseNotFoundException extends AbstractException {
         constructor({ id }: CourseNotFoundExceptionMetadata) {
           super("Course not found", "COURSE_NOT_FOUND_EXCEPTION", { id })
         }
       }`,
      // an alias with nothing to add is still named for its exception
      `export class AdminApiKeyRequiredException extends AbstractException {
         constructor({ originalError }: AdminApiKeyRequiredExceptionMetadata) {
           super("Key required", "ADMIN_API_KEY_REQUIRED_EXCEPTION", { originalError })
         }
       }`,
    ],
    invalid: [
      {
        code: `export class WeeklyChallengeRewardNotEligibleException extends AbstractException {
                 constructor({ originalError }: AbstractExceptionMetadata) {
                   super("Not eligible", "WEEKLY_CHALLENGE_REWARD_NOT_ELIGIBLE_EXCEPTION", { originalError })
                 }
               }`,
        errors: [{ messageId: "named" }],
      },
      {
        // the destructuring carries a default, which puts an assignment pattern between the rule
        // and the type it is reading - the shape that hid two of these from a first measurement
        code: `export class RagPlaygroundInvalidQuestionException extends AbstractException {
                 constructor({ originalError }: AbstractExceptionMetadata = {}) {
                   super("Empty question", "RAG_PLAYGROUND_INVALID_QUESTION_EXCEPTION", { originalError })
                 }
               }`,
        errors: [{ messageId: "named" }],
      },
      {
        code: `export class CourseNotFoundException extends AbstractException {
                 constructor({ id }) {
                   super("Course not found", "COURSE_NOT_FOUND_EXCEPTION", { id })
                 }
               }`,
        errors: [{ messageId: "untyped" }],
      },
    ],
  })
})
