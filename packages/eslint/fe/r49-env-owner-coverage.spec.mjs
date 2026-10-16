// proves: FE_ENV_OWNER@lite
// proves: FE_ENV_OWNER@full
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noEnvOutsideConfig, noHardcodedEndpointFallback } from "./env-owner.mjs"
import { at, fixtureHfs, LITE_FE_DECLARATION } from "./fixtures/typed/tester.mjs"

const CONFIG = at("apps/web/src/modules/config/env.ts")
const COMPONENT = at("apps/web/src/components/blocks/Feed/index.tsx")

for (const edition of ["lite", "full"]) {
  test(`R49 ${edition} accepts config-owned reads and rejects reads outside the owner`, () => {
    const hfs = fixtureHfs(edition === "lite" ? LITE_FE_DECLARATION : undefined, { lite: edition === "lite" })
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
      settings: { starci: { hfs } },
    })
    tester.run("no-env-outside-config", noEnvOutsideConfig, {
      valid: [
        { filename: CONFIG, code: "export const apiUrl = process.env.API_URL" },
        { filename: COMPONENT, code: 'import { config } from "@/modules/config"; const apiUrl = config.apiUrl' },
      ],
      invalid: [
        { filename: COMPONENT, code: "const apiUrl = process.env.API_URL", errors: [{ messageId: "env" }] },
      ],
    })
  })

  test(`R49 ${edition} accepts deployment values and rejects endpoint fallbacks`, () => {
    const hfs = fixtureHfs(edition === "lite" ? LITE_FE_DECLARATION : undefined, { lite: edition === "lite" })
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
      settings: { starci: { hfs } },
    })
    tester.run("no-hardcoded-endpoint-fallback", noHardcodedEndpointFallback, {
      valid: [{ filename: CONFIG, code: "export const apiUrl = process.env.API_URL" }],
      invalid: [
        { filename: CONFIG, code: 'export const apiUrl = process.env.API_URL ?? "http://localhost:3068"', errors: [{ messageId: "url" }] },
        { filename: CONFIG, code: 'export const host = process.env.DB_HOST || "db"', errors: [{ messageId: "variable" }] },
      ],
    })
  })
}
