// proves: FE_TRANSPORT_OWNER@lite
// proves: FE_TRANSPORT_OWNER@full
// proves: FE_EFFECT_FETCH@lite
// proves: FE_EFFECT_FETCH@full
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { clientFetchHasSignal, fetchOnlyInApiClient, noSharedTransportState } from "./transport.mjs"
import { noDataFetchInEffect } from "./hygiene.mjs"
import { rules as localeRules } from "./served-locale.mjs"
import { rules as graphRules } from "./project-graph.mjs"
import { at, fixtureHfs, LITE_FE_DECLARATION, typedTester } from "./fixtures/typed/tester.mjs"

const CLIENT = at("apps/web/src/modules/api/graphql/clients/links/http.ts")
const CHAIN = at("apps/web/src/modules/api/graphql/clients/create-apollo-client.ts")
const LOCALE = at("apps/web/src/modules/api/graphql/clients/links/locale.ts")
const HOOK = at("apps/web/src/hooks/course/useCourse.ts")
const COMPONENT = at("apps/web/src/components/blocks/Feed/index.tsx")
const GRAPH_CLIENT = "apps/web/src/modules/api/graphql/clients/index.ts"
const GRAPH_HOOK = "apps/web/src/hooks/course/useCourse.ts"
const GRAPH_BAD = "apps/web/src/hooks/course/useUnowned.ts"

for (const edition of ["lite", "full"]) {
  test(`R50 ${edition} accepts owned transport shapes and rejects unowned requests, state or locale`, () => {
    const hfs = fixtureHfs(edition === "lite" ? LITE_FE_DECLARATION : undefined, { lite: edition === "lite" })
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
      settings: { starci: { hfs } },
    })
    tester.run("fetch-only-in-api-client", fetchOnlyInApiClient, {
      valid: [{ filename: CLIENT, code: "const response = await fetch(url, { signal })" }],
      invalid: [{ filename: HOOK, code: "const response = await fetch(url)", errors: [{ messageId: "outside" }] }],
    })
    tester.run("client-fetch-has-signal", clientFetchHasSignal, {
      valid: [{ filename: CLIENT, code: "fetch(url, { signal: AbortSignal.timeout(8000) })" }],
      invalid: [{ filename: CLIENT, code: "fetch(url)", errors: [{ messageId: "signal" }] }],
    })
    tester.run("no-shared-transport-state", noSharedTransportState, {
      valid: [{ filename: CLIENT, code: "export const read = () => { let token = null; return token }" }],
      invalid: [{ filename: CLIENT, code: "let token = null", errors: [{ messageId: "shared" }] }],
    })
    tester.run("api-client-attaches-the-locale", localeRules["api-client-attaches-the-locale"], {
      valid: [{ filename: CHAIN, code: "export const chain = () => [createAttachLocaleLink({}), createHttpLink({})]" }],
      invalid: [{ filename: CHAIN, code: "export const chain = () => [createHttpLink({})]", errors: [{ messageId: "missing" }] }],
    })
    tester.run("locale-header-belongs-to-the-link", localeRules["locale-header-belongs-to-the-link"], {
      valid: [{ filename: LOCALE, code: 'const headers = { "Accept-Language": locale }' }],
      invalid: [{ filename: HOOK, code: 'const headers = { "Accept-Language": locale }', errors: [{ messageId: "elsewhere" }] }],
    })
  })

  test(`R50 ${edition} accepts synchronous effects and rejects a data load in an effect`, () => {
    const tester = typedTester({ declaration: edition === "lite" ? LITE_FE_DECLARATION : undefined, lite: edition === "lite" })
    tester.run("no-data-fetch-in-effect", noDataFetchInEffect, {
      valid: [{ filename: COMPONENT, code: 'import { useEffect } from "react"; declare const title: string; useEffect(() => { document.title = title }, [title])' }],
      invalid: [{ filename: COMPONENT, code: 'import { useEffect } from "react"; useEffect(() => { fetch("/courses").then(() => undefined) }, [])', errors: [{ messageId: "fetch" }] }],
    })
  })

  test(`R50 ${edition} accepts the graph transport owner and rejects a second fetch path`, (t) => {
    const files = {
      [GRAPH_CLIENT]: 'import { ApolloClient } from "@apollo/client"; export const authClient = new ApolloClient({ uri: "/graphql", fetch: (input: string) => fetch(input) });',
      "apps/web/src/modules/api/graphql/types.ts": "export type GraphQLResponse<T> = { success: boolean; message: string; error?: string; data?: T };",
      [GRAPH_HOOK]: 'import { authClient } from "../../modules/api/graphql/clients"; export const useCourse = () => authClient;',
      [GRAPH_BAD]: 'export const useUnowned = () => fetch("/courses");',
    }
    const fixture = projectFixture({ profile: "fe", edition, files })
    t.after(() => fixture.cleanup())
    fixture.tester.run("transport-owner", graphRules["transport-owner"], {
      valid: [{ filename: fixture.at(GRAPH_HOOK), code: files[GRAPH_HOOK] }],
      invalid: [{ filename: fixture.at(GRAPH_BAD), code: files[GRAPH_BAD], errors: [{ messageId: "finding" }] }],
    })
  })
}
