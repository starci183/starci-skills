// proves: FE_SWR_OUTSIDE_FAMILY@lite FE_SWR_OUTSIDE_FAMILY@full
// proves: FE_OP_OUTSIDE_SWR_HOOK@lite FE_OP_OUTSIDE_SWR_HOOK@full
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join, relative, resolve } from "node:path"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { at, fixtureHfs, LITE_FE_DECLARATION } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { appDeclaration } from "../be/fixtures/app.mjs"
import { operationsOnlyInSwrHooks, rules, swrOnlyInFamily } from "./swr-family.mjs"

const COMPONENT = at("apps/web/src/components/blocks/Orders/index.tsx")
const HOOK = at("apps/web/src/hooks/orders/useOrders.ts")
const WRAPPER = at("apps/web/src/hooks/swr/api/graphql/queries/useQueryOrdersSwr.ts")
const OP = "@/modules/api/graphql/queries/query-orders"
const testerFor = (lite) => new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
  settings: { starci: { hfs: fixtureHfs(lite ? LITE_FE_DECLARATION : undefined, { lite }) } },
})

for (const lite of [false, true]) {
  const edition = lite ? "lite" : "full"
  test(`R285 FE_SWR_OUTSIDE_FAMILY: consumers call wrappers (${edition})`, () => {
    testerFor(lite).run("swr-only-in-family", swrOnlyInFamily, {
      valid: [
        { filename: WRAPPER, code: 'import useSWR from "swr"; export const useQueryOrdersSwr = () => useSWR("orders", queryOrders)' },
        { filename: COMPONENT, code: 'import { SWRConfig, useSWRConfig, mutate } from "swr"; export const Orders = () => null' },
        { filename: COMPONENT, code: 'import * as cache from "swr"; const Config = cache.SWRConfig' },
        { filename: HOOK, code: 'import { useQueryOrdersSwr } from "@/hooks/swr"; export const useOrders = () => useQueryOrdersSwr()' },
        { filename: HOOK, code: 'import type { SWRResponse } from "swr"; export const useOrders = () => 1' },
        { filename: HOOK, code: 'const useSWR = () => 1; export const useOrders = () => useSWR()' },
        { filename: HOOK, code: 'export { SWRConfig } from "swr"' },
      ],
      invalid: [
        { filename: COMPONENT, code: 'import useSWR from "swr"; export const Orders = () => useSWR("orders", load)', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'import { default as query } from "swr"; export const useOrders = () => query("orders", load)', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'import useMutation from "swr/mutation"; export const useOrders = () => useMutation("orders", save)', errors: [{ messageId: "outside" }] },
        { filename: COMPONENT, code: 'import * as swr from "swr"; export const Orders = () => swr.default("orders", load)', errors: [{ messageId: "outside" }] },
        { filename: COMPONENT, code: 'import * as swr from "swr"; const { default: useRequest } = swr', errors: [{ messageId: "outside" }] },
        { filename: at("apps/web/src/hooks/swr/SwrSideEffects.tsx"), code: 'import useSWR from "swr"', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'export { default as useRequest } from "swr"', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'export * from "swr"', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'const request = import("swr/mutation")', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'const request = require("swr/infinite")', errors: [{ messageId: "outside" }] },
      ],
    })
  })

  test(`R285 FE_OP_OUTSIDE_SWR_HOOK: only wrappers consume operations (${edition})`, () => {
    testerFor(lite).run("operations-only-in-swr-hooks", operationsOnlyInSwrHooks, {
      valid: [
        { filename: WRAPPER, code: `import useSWR from "swr"; import { queryOrders } from "${OP}"; export const useQueryOrdersSwr = () => useSWR("orders", queryOrders)` },
        { filename: WRAPPER, code: `import * as requests from "swr"; import { queryOrders } from "${OP}"; export const useQueryOrdersSwr = () => requests.default("orders", queryOrders)` },
        { filename: WRAPPER, code: `import useSWR from "swr"; import { queryOrders } from "${OP}"; const request = useSWR; export const useQueryOrdersSwr = () => request("orders", queryOrders)` },
        { filename: WRAPPER, code: `import useSWR from "swr"; import { queryOrders } from "${OP}"; const fetcher = () => queryOrders(); export const useQueryOrdersSwr = () => useSWR("orders", fetcher)` },
        { filename: at("apps/web/src/hooks/swr/api/graphql/mutations/useMutateOrderSwr.ts"), code: 'import useSWRMutation from "swr/mutation"; import { mutateOrder } from "@/modules/api/graphql/mutations/mutation-order"; export const useMutateOrderSwr = () => useSWRMutation("order", mutateOrder)' },
        { filename: HOOK, code: `import type { QueryOrdersData } from "${OP}"; export const useOrders = () => 1` },
        { filename: HOOK, code: `import { type QueryOrdersData } from "${OP}"; export const useOrders = () => 1` },
        { filename: COMPONENT, code: 'import { useQueryOrdersSwr } from "@/hooks/swr"; export const Orders = () => useQueryOrdersSwr()' },
        { filename: at("apps/web/src/modules/api/graphql/queries/query-orders.ts"), code: 'import { client } from "@/modules/api/graphql/clients"; export const queryOrders = () => client.query({})' },
        { filename: HOOK, code: 'import { GraphQLResponse } from "@/modules/api/graphql/types"; export const useOrders = () => 1' },
        { filename: HOOK, code: 'require(123); import(123)' },
      ],
      invalid: [
        { filename: HOOK, code: `import { queryOrders } from "${OP}"; export const useOrders = () => queryOrders()`, errors: [{ messageId: "outside" }] },
        { filename: COMPONENT, code: `import { queryOrders as load } from "${OP}"; export const Orders = () => load()`, errors: [{ messageId: "outside" }] },
        { filename: at("apps/web/src/features/pages/OrdersPage/index.tsx"), code: `import { queryOrders } from "${OP}"; export const OrdersPage = async () => await queryOrders()`, errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'import { queryOrders } from "../../modules/api/graphql/queries/query-orders"', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'import { getUpload } from "@/modules/api/rest/uploads/get-upload"', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'import { queryOrders } from "@/modules/api"', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: 'import { client } from "@/modules/api/graphql/clients/client"; export const useOrders = () => client.query({})', errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: `export { queryOrders } from "${OP}"`, errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: `export * from "${OP}"`, errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: `const operations = import("${OP}")`, errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: "const operations = import(`@/modules/api/graphql/queries/query-orders`)", errors: [{ messageId: "outside" }] },
        { filename: HOOK, code: `const operations = require("${OP}")`, errors: [{ messageId: "outside" }] },
        { filename: WRAPPER, code: `import { queryOrders } from "${OP}"; export const useQueryOrdersSwr = () => queryOrders()`, errors: [{ messageId: "outside" }] },
        { filename: WRAPPER, code: `import useSWR from "swr"; import { queryOrders } from "${OP}"; export const useQueryOrdersSwr = () => { const useSWR = () => queryOrders(); return useSWR() }`, errors: [{ messageId: "outside" }] },
        { filename: WRAPPER, code: `import useSWR from "swr"; import { queryOrders } from "${OP}"; useSWR("dummy", () => 1); export const useQueryOrdersSwr = () => queryOrders()`, errors: [{ messageId: "outside" }] },
        { filename: WRAPPER, code: `import useSWR from "swr"; import { queryOrders } from "${OP}"; queryOrders(); export const useQueryOrdersSwr = () => useSWR("orders", queryOrders)`, errors: [{ messageId: "outside" }] },
        { filename: at("apps/web/src/hooks/swr/SwrSideEffects.tsx"), code: `import { queryOrders } from "${OP}"`, errors: [{ messageId: "outside" }] },
      ],
    })
  })
}

test("R285: bare workspace API imports use declared package identity", (t) => {
  const temporaryRoot = resolve(tmpdir())
  const root = mkdtempSync(join(temporaryRoot, "starci-a14-api-"))
  const withinTemporaryRoot = relative(temporaryRoot, resolve(root))
  assert.ok(withinTemporaryRoot && !withinTemporaryRoot.startsWith("..") && !isAbsolute(withinTemporaryRoot))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const api = join(root, "packages", "commerce-api")
  mkdirSync(api, { recursive: true })
  writeFileSync(join(api, "package.json"), JSON.stringify({ name: "@shop/data-door" }))
  const hfs = hfsFromDeclaration(appDeclaration("fe", {
    apps: [{ name: "web", kind: "next" }], optionalSlots: ["repo.packages", "fe.package.api"],
  }), root)
  const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
    settings: { starci: { hfs } },
  })
  tester.run("operations-only-in-swr-hooks", operationsOnlyInSwrHooks, {
    valid: [{
      filename: join(root, "apps/web/src/hooks/swr/api/graphql/queries/useQueryOrdersSwr.ts"),
      code: 'import useSWR from "swr"; import { queryOrders } from "@shop/data-door"; export const useQueryOrdersSwr = () => useSWR("orders", queryOrders)',
    }],
    invalid: [
      { filename: join(root, "apps/web/src/hooks/orders/useOrders.ts"), code: 'import { queryOrders } from "@shop/data-door"', errors: [{ messageId: "outside" }] },
      { filename: join(root, "apps/web/src/hooks/orders/useOrders.ts"), code: 'import { queryOrders } from "@shop/data-door/graphql/queries/query-orders"', errors: [{ messageId: "outside" }] },
    ],
  })
})

test("R285: append-only plugin registration preserves every new enforcer and owner", async () => {
  const plugin = await import("./index.mjs")
  for (const [name, rule] of Object.entries(rules)) {
    assert.equal(plugin.rules[name], rule)
    assert.equal(plugin.recommended[`starci-fe/${name}`], "error")
    assert.equal(plugin.ruleOwners[name], "swr-family")
    assert.equal(plugin.ruleDeclarations.filter((entry) => entry.name === name).length, 1)
  }
})
