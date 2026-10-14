/**
 * Twin tests for the environment-owner rules (HFS R49).
 *
 *   node --test env-owner.spec.mjs
 */
// proves: FE_ENV_OWNER@lite FE_ENV_OWNER@full
import assert from "node:assert/strict"
import test from "node:test"
import { at, fixtureHfs, LITE_FE_DECLARATION, slotTester } from "./fixtures/typed/tester.mjs"
import { noEnvOutsideConfig, noHardcodedEndpointFallback, rules } from "./env-owner.mjs"

const tester = slotTester()

const CONFIG = at("apps/web/src/modules/config/env.ts")
const BLOCK = at("apps/web/src/components/blocks/Feed/index.tsx")

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

for (const edition of ["lite", "full"]) {
  test(`FE-ENV-1: computed, destructured and aliased environment reads in ${edition}`, () => {
    const settings = { starci: { hfs: fixtureHfs(edition === "lite" ? LITE_FE_DECLARATION : undefined, { lite: edition === "lite" }) } }
    const valid = [
      { filename: CONFIG, code: "const p = process; export const url = p[\"env\"].API_URL" },
      { filename: CONFIG, code: "const { [\"env\"]: env } = import.meta; export const url = env.VITE_API_URL" },
      { filename: CONFIG, code: "let env; ({ env } = globalThis.process)" },
      { filename: CONFIG, code: "import { env } from \"node:process\"; export const url = env.API_URL" },
      { filename: BLOCK, code: "const p = process; const directory = p.cwd()" },
      { filename: BLOCK, code: "const meta = import.meta; const url = meta.url" },
      { filename: BLOCK, code: "const { env } = settings; const url = env.API_URL" },
      { filename: BLOCK, code: "import { env } from \"./settings\"; const url = env.API_URL" },
      { filename: BLOCK, code: "import type { env } from \"node:process\"; type Env = typeof env" },
      { filename: BLOCK, code: "import { type env } from \"node:process\"; type Env = typeof env" },
      { filename: BLOCK, code: "const process = { env: settings }; const url = process[\"env\"].API_URL" },
      { filename: BLOCK, code: "function read(process) { const { env } = process; return env.API_URL }" },
      { filename: BLOCK, code: "const p = process; function read(p) { return p.env.API_URL }" },
      { filename: BLOCK, code: "let p = process; p = settings; const url = p.env.API_URL" },
      { filename: BLOCK, code: "const globalThis = { process: settings }; const url = globalThis.process.env.API_URL" },
      { filename: BLOCK, code: "const key = `env${suffix}`; const value = process[key]" },
    ]
    const invalid = [
      "const url = process[\"env\"][\"API_URL\"]",
      "const url = process[`env`].API_URL",
      "const url = import.meta[\"env\"].VITE_API_URL",
      "const { API_URL } = process[\"env\"]",
      "const { VITE_API_URL } = import.meta[\"env\"]",
      "const { \"env\": env } = process",
      "const { [\"env\"]: env } = import.meta",
      "let env; ({ [\"env\"]: env } = process)",
      "function read({ env } = import.meta) { return env.VITE_API_URL }",
      "const p = process; const url = p.env.API_URL",
      "const p = process; const q = p; const { env } = q",
      "const meta = import.meta; const { env } = meta",
      "let meta; meta = import.meta; const url = meta[\"env\"].VITE_API_URL",
      "let p; p = process; const { env } = p",
      "const { process: p } = globalThis; const url = p.env.API_URL",
      "const { process: { [\"env\"]: env } } = globalThis",
      "const url = globalThis[\"process\"][\"env\"].API_URL",
      "const key = \"env\"; const url = process[key].API_URL",
      "const key = \"env\"; const { [key]: env } = import.meta",
      "const p = process as unknown; const url = (p as typeof process).env.API_URL",
      "const p = process; { const p = settings; const url = p.env.API_URL } const url = p.env.API_URL",
      "function read(p = process) { return p.env.API_URL }",
      "function read() { return p.env.API_URL } const p = process",
      "const p = process; function replace() { p = settings } const url = p.env.API_URL",
      "import p from \"node:process\"; const url = p[\"env\"].API_URL",
      "import * as p from \"process\"; const { env } = p",
      "import { default as p } from \"node:process\"; const url = p.env.API_URL",
      "import { env as e } from \"node:process\"; const url = e.API_URL",
      "let p = process; p = p; const url = p.env.API_URL",
      "let key = \"env\"; key = key; const url = import.meta[key].VITE_API_URL",
    ].map((code) => ({ filename: BLOCK, code, errors: [{ messageId: "env" }] }))
    tester.run(`no-env-outside-config-${edition}`, noEnvOutsideConfig, {
      valid: valid.map((fixture) => ({ ...fixture, settings })),
      invalid: invalid.map((fixture) => ({ ...fixture, settings })),
    })
  })
}

test("FE-ENV-2: no URL literal or address/secret default as a fallback", () => {
  tester.run("no-hardcoded-endpoint-fallback", noHardcodedEndpointFallback, {
    valid: [
      { filename: CONFIG, code: "export const url = process.env.API_URL" },
      { filename: CONFIG, code: "export const port = process.env.PORT ?? \"3000\"" },
      { filename: CONFIG, code: "export const url = process.env.API_URL ?? \"\"" },
      { filename: BLOCK, code: "const label = props.label ?? \"\"" },
      { filename: BLOCK, code: "const path = props.path || \"/home\"" },
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
