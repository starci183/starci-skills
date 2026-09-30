/**
 * Twin tests for the environment-owner rules (HFS R49).
 *
 *   node --test env-owner.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { noEnvOutsideConfig, noHardcodedEndpointFallback, rules } from "./env-owner.mjs"

const tester = slotTester()

const CONFIG = at("apps/web/src/modules/config/env.ts")
const BLOCK = at("apps/web/src/components/blocks/Feed/index.tsx")
const SPEC = at("apps/web/src/components/blocks/Feed/index.test.tsx")

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("FE-ENV-1: only modules/config reads the environment", () => {
  tester.run("no-env-outside-config", noEnvOutsideConfig, {
    valid: [
      { filename: CONFIG, code: "export const url = process.env.API_URL" },
      { filename: CONFIG, code: "export const url = import.meta.env.VITE_API_URL" },
      // every app of the repository has its own config module
      { filename: at("apps/admin/src/modules/config/index.ts"), code: "export const url = process.env.API_URL" },
      { filename: BLOCK, code: "import { config } from \"@/modules/config\"\nconst url = config.apiUrl" },
      // a spec stubs the environment to prove the config module, it does not own a reader
      { filename: SPEC, code: "process.env.API_URL = \"x\"" },
      // an unrelated `.env` member is not the environment
      { filename: BLOCK, code: "const a = settings.env.name" },
    ],
    invalid: [
      // another module of the app is not the config module, even one that sits beside it
      { filename: at("apps/web/src/modules/api/client.ts"), code: "const url = process.env.API_URL", errors: [{ messageId: "env" }] },
      { filename: BLOCK, code: "const url = process.env.API_URL", errors: [{ messageId: "env" }] },
      { filename: BLOCK, code: "const url = process.env[\"API_URL\"]", errors: [{ messageId: "env" }] },
      { filename: BLOCK, code: "const url = import.meta.env.VITE_API_URL", errors: [{ messageId: "env" }] },
      { filename: BLOCK, code: "const { env } = process", errors: [{ messageId: "env" }] },
      { filename: at("apps/web/src/hooks/session/useSession.ts"), code: "if (process.env.NODE_ENV === \"production\") {}", errors: [{ messageId: "env" }] },
    ],
  })
})

test("FE-ENV-2: no URL literal or address/secret default as a fallback", () => {
  tester.run("no-hardcoded-endpoint-fallback", noHardcodedEndpointFallback, {
    valid: [
      { filename: CONFIG, code: "export const url = process.env.API_URL" },
      { filename: CONFIG, code: "export const port = process.env.PORT ?? \"3000\"" },
      { filename: CONFIG, code: "export const url = process.env.API_URL ?? \"\"" },
      { filename: BLOCK, code: "const label = props.label ?? \"\"" },
      { filename: BLOCK, code: "const path = props.path || \"/home\"" },
      { filename: SPEC, code: "const url = process.env.API_URL ?? \"http://localhost:3068\"" },
    ],
    invalid: [
      { filename: CONFIG, code: "export const url = process.env.API_URL ?? \"http://localhost:3068\"", errors: [{ messageId: "url" }] },
      { filename: BLOCK, code: "const url = base || \"https://api.example.com\"", errors: [{ messageId: "url" }] },
      { filename: BLOCK, code: "const url = base ?? `http://127.0.0.1:3068`", errors: [{ messageId: "url" }] },
      { filename: BLOCK, code: "const f = (base = \"http://localhost:3068\") => base", errors: [{ messageId: "url" }] },
      { filename: CONFIG, code: "export const key = process.env.SESSION_SECRET ?? \"dev-secret\"", errors: [{ messageId: "variable" }] },
      { filename: CONFIG, code: "export const host = process.env[\"DB_HOST\"] || \"db\"", errors: [{ messageId: "variable" }] },
    ],
  })
})
