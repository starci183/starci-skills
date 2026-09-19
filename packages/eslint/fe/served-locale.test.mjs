/**
 * Twin tests for the served-locale rules.
 *
 *   node --test served-locale.test.mjs
 *
 * The case that decides whether the first rule is honest is the EXEMPTION: a file that mentions
 * links but builds no terminal one must not be reported, because there is nothing there to attach a
 * locale to. A rule that fires on every file in a clients folder would be satisfied by scattering
 * the locale link through helpers, which is the opposite of what the law asks for.
 *
 * The second rule's honest case is the locale link ITSELF. A rule refusing `x-locale` everywhere
 * would refuse the one file that has to write it, and there would be no correct way to satisfy the
 * pair at once.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { LOCALE_HEADER, isLinkImplementationFile, isLocaleLinkFile, isTestFile, rules } from "./served-locale.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const CLIENT = "D:/repo/src/modules/api/graphql/clients/create-apollo-client.ts"
const LOCALE_LINK = "D:/repo/src/modules/api/graphql/clients/links/locale.ts"
const HTTP_LINK = "D:/repo/src/modules/api/graphql/clients/links/http.ts"
const HTTP_LINK_SPEC = "D:/repo/src/modules/api/graphql/clients/links/http.test.ts"
const HOOK = "D:/repo/src/hooks/swr/useQueryCourseSwr.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.equal(typeof rule.create, "function", `${name} publishes no create()`)
    assert.ok(rule.meta?.messages, `${name} publishes no messages`)
  }
})

test("the locale link file is recognised on both slash styles", () => {
  assert.equal(isLocaleLinkFile(LOCALE_LINK), true)
  assert.equal(isLocaleLinkFile("D:\\repo\\src\\api\\clients\\links\\locale.ts"), true)
  assert.equal(isLocaleLinkFile("D:/repo/src/api/clients/links/bearer.ts"), false)
  assert.equal(isLocaleLinkFile("D:/repo/src/i18n/locale.ts"), false)
})

test("the header this law is about is the one the server reads", () => {
  assert.equal(LOCALE_HEADER, "x-locale")
})

test("a single link's implementation is not a chain, and a spec is not production", () => {
  assert.equal(isLinkImplementationFile(HTTP_LINK), true)
  assert.equal(isLinkImplementationFile(LOCALE_LINK), true)
  assert.equal(isLinkImplementationFile(CLIENT), false)
  assert.equal(isTestFile(HTTP_LINK_SPEC), true)
  assert.equal(isTestFile("D:/repo/src/a/b.spec.tsx"), true)
  assert.equal(isTestFile(CLIENT), false)
})

tester.run("api-client-attaches-the-locale", rules["api-client-attaches-the-locale"], {
  valid: [
    {
      // The chain the law asks for: the locale attached beside the auth link, unconditionally.
      filename: CLIENT,
      code: `const chain = ({ withAuth }) => [
  createRetryLink(),
  createAttachLocaleLink({}),
  ...(withAuth ? [createAttachBearerTokenLink({})] : []),
  createHttpLink({}),
]
export default chain`,
    },
    {
      // A file that builds no terminal link has nothing to attach a locale to. Firing here would
      // push the locale link into every helper, which is the opposite of one place owning it.
      filename: "D:/repo/src/modules/api/graphql/clients/links/retry.ts",
      code: `export const createRetryLink = () => new RetryLink({})`,
    },
    {
      // The locale link's own file, which constructs no terminal link either.
      filename: LOCALE_LINK,
      code: `export const createAttachLocaleLink = () => new ApolloLink((op, forward) => forward(op))`,
    },
    {
      // The file that DEFINES the terminal link. Found by running the first version against real
      // source, which reported this and its spec on a repository that had done everything right -
      // and there is no correct way to satisfy it here, because a locale link inside the http link
      // is a chain hiding in a link.
      filename: HTTP_LINK,
      code: `export const createHttpLink = (params) => new HttpLink(resolveHttpLinkOptions(params))`,
    },
    {
      // Its spec asserts about a chain rather than being one.
      filename: HTTP_LINK_SPEC,
      code: `test("builds the terminal link", () => { createHttpLink({}) })`,
    },
    {
      // `new HttpLink(...)` is the same terminal link written the other way, and it is attached.
      filename: CLIENT,
      code: `const chain = () => [createAttachLocaleLink({}), new HttpLink({})]
export default chain`,
    },
  ],
  invalid: [
    {
      // The chain is complete, authenticated, retried - and mute about language.
      filename: CLIENT,
      code: `const chain = ({ withAuth }) => [
  createRetryLink(),
  ...(withAuth ? [createAttachBearerTokenLink({})] : []),
  createHttpLink({}),
]
export default chain`,
      errors: [{ messageId: "missing" }],
    },
    {
      // The `new` form is refused on the same terms as the call form.
      filename: CLIENT,
      code: `const chain = () => [createRetryLink(), new HttpLink({})]
export default chain`,
      errors: [{ messageId: "missing" }],
    },
  ],
})

tester.run("locale-header-belongs-to-the-link", rules["locale-header-belongs-to-the-link"], {
  valid: [
    {
      // The one file allowed to write it. Refusing here would leave the pair unsatisfiable.
      filename: LOCALE_LINK,
      code: `const headers = { "x-locale": locale }
export default headers`,
    },
    {
      // An unrelated header at a call site is nobody's business but the caller's.
      filename: HOOK,
      code: `const headers = { authorization: "Bearer x" }
export default headers`,
    },
  ],
  invalid: [
    {
      // A hook answering the same question the link already answers.
      filename: HOOK,
      code: `const headers = { "x-locale": "vi" }
export default headers`,
      errors: [{ messageId: "elsewhere" }],
    },
    {
      // The computed-key spelling reads identically to the server, so it is refused identically.
      filename: HOOK,
      code: `const headers = { ["x-locale"]: locale }
export default headers`,
      errors: [{ messageId: "elsewhere" }],
    },
  ],
})
