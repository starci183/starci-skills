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
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { LOCALE_HEADER, rules } from "./served-locale.mjs"

const tester = slotTester()

const API = "apps/web/src/modules/api/graphql/clients"
const CLIENT = at(`${API}/create-apollo-client.ts`)
const LOCALE_LINK = at(`${API}/links/locale.ts`)
const HTTP_LINK = at(`${API}/links/http.ts`)
const HOOK = at("apps/web/src/hooks/swr/useQueryCourseSwr.ts")

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.equal(typeof rule.create, "function", `${name} publishes no create()`)
    assert.ok(rule.meta?.messages, `${name} publishes no messages`)
  }
})

test("the header this law is about is the one the server reads", () => {
  assert.equal(LOCALE_HEADER, "x-locale")
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
      filename: at(`${API}/links/retry.ts`),
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
      // `new HttpLink(...)` is the same terminal link written the other way, and it is attached.
      filename: CLIENT,
      code: `const chain = () => [createAttachLocaleLink({}), new HttpLink({})]
export default chain`,
    },
    {
      // The shared api package keeps its own links, and its link implementation is not a chain either.
      filename: at("packages/nivo-api/src/links/http.ts"),
      code: `export const createHttpLink = (params) => new HttpLink(params)`,
    },
  ],
  invalid: [
    {
      // A `links` folder outside the transport slots is no link implementation: a chain assembled there is judged as a chain.
      filename: at("apps/web/src/modules/utils/links/http.ts"),
      code: `export const chain = () => [createHttpLink({})]`,
      errors: [{ messageId: "missing" }],
    },
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
    {
      // The shared api package has its own locale link, the one place there.
      filename: at("packages/nivo-api/src/links/locale.ts"),
      code: `const headers = { "x-locale": locale }
export default headers`,
    },
  ],
  invalid: [
    {
      // A file called like the locale link outside the transport slots is not it.
      filename: at("apps/web/src/hooks/swr/links/locale.ts"),
      code: `const headers = { "x-locale": "vi" }
export default headers`,
      errors: [{ messageId: "elsewhere" }],
    },
    {
      // Nor is another link of the same folder, or the client file that assembles them.
      filename: at(`${API}/links/retry.ts`),
      code: `const headers = { "x-locale": "vi" }
export default headers`,
      errors: [{ messageId: "elsewhere" }],
    },
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
