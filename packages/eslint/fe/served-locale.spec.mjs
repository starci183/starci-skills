/**
 * Twin tests for the served-locale rules.
 *
 *   node --test served-locale.spec.mjs
 *
 * The case that decides whether the first rule is honest is the EXEMPTION: a file that mentions
 * links but builds no terminal one must not be reported, because there is nothing there to attach a
 * locale to. A rule that fires on every file in a clients folder would be satisfied by scattering
 * the locale link through helpers, which is the opposite of what the law asks for.
 *
 * The second rule's honest case is the locale link ITSELF. A rule refusing `Accept-Language` everywhere
 * would refuse the one file that has to write it, and there would be no correct way to satisfy the
 * pair at once.
 */
// proves: FE_TRANSPORT_OWNER@lite
// proves: FE_TRANSPORT_OWNER@full
import assert from "node:assert/strict"
import test from "node:test"
import { at, fixtureHfs, LITE_FE_DECLARATION, slotTester } from "./fixtures/typed/tester.mjs"
import { LOCALE_HEADER, rules } from "./served-locale.mjs"

const tester = slotTester()

const API = "apps/web/src/modules/api/graphql/clients"
const CLIENT = at(`${API}/create-apollo-client.ts`)
const LOCALE_LINK = at(`${API}/links/locale.ts`)
const HTTP_LINK = at(`${API}/links/http.ts`)
const HOOK = at("apps/web/src/hooks/swr/api/graphql/queries/useQueryCourseSwr.ts")

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.equal(typeof rule.create, "function", `${name} publishes no create()`)
    assert.ok(rule.meta?.messages, `${name} publishes no messages`)
  }
})

test("the header this law is about is the one the server reads", () => {
  assert.equal(LOCALE_HEADER, "Accept-Language")
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
    {
      // The same in the shared package's clients folder (slot fe.package.api.client).
      filename: at("packages/nivo-api/src/graphql/clients/links/http.ts"),
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
      code: `const headers = { "Accept-Language": locale }
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
      code: `const headers = { "Accept-Language": locale }
export default headers`,
    },
    {
      // The locale link of the shared package's clients folder, with case-insensitive spelling.
      filename: at("packages/nivo-api/src/graphql/clients/links/locale.ts"),
      code: `const headers = { "accept-language": locale }
export default headers`,
    },
  ],
  invalid: [
    {
      // A file called like the locale link outside the transport slots is not it.
      filename: at("apps/web/src/hooks/swr/links/locale.ts"),
      code: `const headers = { "Accept-Language": "vi" }
export default headers`,
      errors: [{ messageId: "elsewhere" }],
    },
    {
      // Nor is another link of the same folder, or the client file that assembles them.
      filename: at(`${API}/links/retry.ts`),
      code: `const headers = { "Accept-Language": "vi" }
export default headers`,
      errors: [{ messageId: "elsewhere" }],
    },
    {
      // A hook answering the same question the link already answers.
      filename: HOOK,
      code: `const headers = { "Accept-Language": "vi" }
export default headers`,
      errors: [{ messageId: "elsewhere" }],
    },
    {
      // The computed-key spelling reads identically to the server, so it is refused identically.
      filename: HOOK,
      code: `const headers = { ["Accept-Language"]: locale }
export default headers`,
      errors: [{ messageId: "elsewhere" }],
    },
    {
      // A header name is case-insensitive: `ACCEPT-LANGUAGE` is the same header.
      filename: HOOK,
      code: `const headers = { "ACCEPT-LANGUAGE": "vi" }
export default headers`,
      errors: [{ messageId: "elsewhere" }],
    },
  ],
})

for (const edition of ["lite", "full"]) {
  const hfs = edition === "lite" ? fixtureHfs(LITE_FE_DECLARATION, { lite: true }) : fixtureHfs()
  const inEdition = (fixture) => ({ ...fixture, settings: { starci: { hfs } } })
  tester.run(`locale-header-belongs-to-the-link (${edition})`, rules["locale-header-belongs-to-the-link"], {
    valid: [
      {
        filename: LOCALE_LINK,
        code: `const headers = { "Accept-Language": locale }`,
      },
      {
        filename: LOCALE_LINK,
        code: `const headers = { ["accept-language"]: locale }`,
      },
      {
        filename: LOCALE_LINK,
        code: `const headers = new Headers([["ACCEPT-LANGUAGE", locale]])`,
      },
      {
        filename: HOOK,
        code: `const headers = new Headers([["authorization", token]])`,
      },
      {
        filename: HOOK,
        code: `const entries = new Map([["x-locale", locale], ["Accept-Language", locale]])`,
      },
      {
        filename: HOOK,
        code: `class Headers { constructor(entries) {} }
const headers = new Headers([["x-locale", locale], ["Accept-Language", locale]])`,
      },
      {
        filename: HOOK,
        code: `const globalThis = { Headers: class { constructor(entries) {} } }
const headers = new globalThis.Headers([["x-locale", locale]])`,
      },
      {
        filename: HOOK,
        code: `const headers = { authorization: token }`,
      },
      {
        filename: LOCALE_LINK,
        code: `const headers = new Headers()
headers["Accept-Language"] = locale
headers.set("Accept-Language", locale)
headers.append(\`accept-language\`, locale)`,
      },
      {
        // Reading either header is not writing it.
        filename: HOOK,
        code: `const headers = new Headers()
const locale = headers["Accept-Language"]
const oldLocale = headers.get("x-locale")`,
      },
      {
        // A map's setters are not header writers, even if their keys name headers.
        filename: HOOK,
        code: `const entries = new Map()
entries.set("x-locale", locale)
const list = { append: (key, value) => value }
list.append("Accept-Language", locale)`,
      },
      {
        // A local constructor named Headers is not the browser's Headers.
        filename: HOOK,
        code: `class Headers { set(key, value) { return value } }
const headers = new Headers()
headers.set("Accept-Language", locale)`,
      },
      {
        filename: HOOK,
        code: `const request = { headers: new Map() }
request.headers.set("x-locale", locale)`,
      },
      {
        // The initializer cannot establish a receiver after its binding has been reassigned.
        filename: HOOK,
        code: `let headers: any = new Headers()
headers = new Map()
headers.set("x-locale", locale)
headers.append("Accept-Language", locale)`,
      },
    ].map(inEdition),
    invalid: [
      {
        filename: LOCALE_LINK,
        code: `const headers = { "x-locale": locale }`,
        errors: [{ messageId: "retired" }],
      },
      {
        filename: LOCALE_LINK,
        code: `const headers = { ["X-Locale"]: locale, "Accept-Language": locale }`,
        errors: [{ messageId: "retired" }],
      },
      {
        filename: HOOK,
        code: `const headers = { "X-LOCALE": locale }`,
        errors: [{ messageId: "retired" }],
      },
      {
        filename: LOCALE_LINK,
        code: `const headers = new Headers([["x-locale", locale], ["Accept-Language", locale]])`,
        errors: [{ messageId: "retired" }],
      },
      {
        filename: HOOK,
        code: `const headers = new globalThis.Headers([["X-LOCALE", locale]])`,
        errors: [{ messageId: "retired" }],
      },
      {
        filename: HOOK,
        code: `const headers = new window.Headers([[\`accept-language\`, locale]])`,
        errors: [{ messageId: "elsewhere" }],
      },
      {
        filename: HOOK,
        code: `const headers = new Headers([["Accept-Language", locale], ["x-locale", locale]])`,
        errors: [{ messageId: "elsewhere" }, { messageId: "retired" }],
      },
      {
        filename: HOOK,
        code: `const headers = { ["accept-language"]: locale }`,
        errors: [{ messageId: "elsewhere" }],
      },
      {
        filename: HOOK,
        code: `headers["Accept-Language"] = locale`,
        errors: [{ messageId: "elsewhere" }],
      },
      {
        filename: LOCALE_LINK,
        code: `headers[\`X-Locale\`] = locale`,
        errors: [{ messageId: "retired" }],
      },
      {
        filename: LOCALE_LINK,
        code: `const headers = { [\`x-locale\`]: locale }`,
        errors: [{ messageId: "retired" }],
      },
      {
        filename: LOCALE_LINK,
        code: `const headers = new Headers()
const alias = headers
alias.set("x-locale", locale)`,
        errors: [{ messageId: "retired" }],
      },
      {
        filename: HOOK,
        code: `new Headers().append(\`Accept-Language\`, locale)`,
        errors: [{ messageId: "elsewhere" }],
      },
      {
        filename: LOCALE_LINK,
        code: `new globalThis.Headers().append("X-LOCALE", locale)`,
        errors: [{ messageId: "retired" }],
      },
      {
        filename: HOOK,
        code: `function attach(headers: Headers) { headers.set("Accept-Language", locale) }`,
        errors: [{ messageId: "elsewhere" }],
      },
      {
        filename: HOOK,
        code: `const request = new Request(url)
request.headers.set("Accept-Language", locale)`,
        errors: [{ messageId: "elsewhere" }],
      },
      {
        filename: LOCALE_LINK,
        code: `const response = new Response()
const headers = response.headers
headers.set("x-locale", locale)`,
        errors: [{ messageId: "retired" }],
      },
    ].map(inEdition),
  })
}
