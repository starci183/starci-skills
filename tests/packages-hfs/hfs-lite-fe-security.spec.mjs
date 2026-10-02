import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { createRequire } from "node:module"

const ROOT = path.resolve(import.meta.dirname, "..", "..")
const TEMPLATE_ROOT = path.join(ROOT, "packages", "hfs", "templates", "fe", "skeleton-lite", "apps", "web", "src")
const TABLE_TEMPLATE = path.join(ROOT, "packages", "hfs", "templates", "fe", "table", "write.ts.tpl")
const ts = createRequire(import.meta.url)("typescript")

const templateText = (relative) => fs.readFileSync(path.join(TEMPLATE_ROOT, ...relative.split("/")), "utf8")

const evaluateTemplate = (relative) => {
  const compiled = ts.transpileModule(templateText(relative), {
    fileName: relative,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  assert.deepEqual(compiled.diagnostics, [], `${relative} has valid TypeScript syntax`)
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, URL, decodeURIComponent }, { filename: relative })
  return module.exports
}

test("safeNextPath keeps callback redirects on the request origin", () => {
  const { safeNextPath } = evaluateTemplate("modules/routes/safe-next-path.ts")
  const origin = "https://app.example"
  const cases = [
    [null, "/"],
    ["/\\evil.com", "/"],
    ["//evil.com", "/"],
    ["https://x", "/"],
    ["/\u0009evil.com", "/"],
    ["/%5Cevil.com", "/"],
    ["/%2F%2Fevil.com", "/"],
    ["/%00evil.com", "/"],
    ["/%E0%A4%A", "/"],
    ["/ok", "/ok"],
    ["/a/b?c=d", "/a/b?c=d"],
  ]
  for (const [candidate, expected] of cases) assert.equal(safeNextPath(candidate, origin), expected, String(candidate))
  assert.match(templateText("app/auth/callback/route.ts"), /safeNextPath\([^,]+, request\.nextUrl\.origin\)/)
})

test("the shared schemas bound UUIDs and sign-in credentials before transport", () => {
  const { rowSchema, signInInputSchema } = evaluateTemplate("modules/db/schema.ts")
  for (const id of [
    "123e4567-e89b-12d3-a456-426614174000",
    "123E4567-E89B-12D3-A456-426614174000",
  ]) {
    assert.equal(rowSchema.safeParse({ id }).success, true)
  }
  for (const id of [
    "",
    "123e4567e89b12d3a456426614174000",
    "123e4567-e89b-12d3-a456-42661417400",
    "123e4567-e89b-12d3-a456-4266141740000",
    "123e4567-e89b-12d3-a456-42661417400g",
  ]) {
    assert.equal(rowSchema.safeParse({ id }).success, false)
  }

  const form = (email, password) => ({ get: (name) => name === "email" ? email : password })
  assert.equal(signInInputSchema.safeParse(form(`${"a".repeat(242)}@example.com`, "p".repeat(8))).success, true)
  assert.equal(signInInputSchema.safeParse(form(`${"a".repeat(243)}@example.com`, "p".repeat(8))).success, false)
  assert.equal(signInInputSchema.safeParse(form("a@example.com", "p".repeat(7))).success, false)
  assert.equal(signInInputSchema.safeParse(form("a@example.com", "p".repeat(256))).success, true)
  assert.equal(signInInputSchema.safeParse(form("a@example.com", "p".repeat(257))).success, false)

  const writer = fs.readFileSync(TABLE_TEMPLATE, "utf8")
  assert.match(writer, /import \{ rowSchema \} from "\.\.\/schema"/)
  assert.match(writer, /if \(!parsed\.success\) return dbFailure\("invalid", "\{\{table\}\}-input"\)/)
})

test("sign-out uses the server client while the browser client refresh hook stays live", () => {
  const action = templateText("modules/db/auth/write-sign-out.ts")
  assert.match(action, /const principal = await getPrincipal\(\)[\s\S]*createServerDbClient\(\)[\s\S]*auth\.signOut\(\)/)
  assert.match(action, /dbFailure\(result\.error\.status === 401 \? "refused" : "unavailable"/)

  const signOut = templateText("components/blocks/SignOutButton/index.tsx")
  assert.match(signOut, /import \{ writeSignOut \} from "@\/modules\/db\/auth\/write-sign-out"/)
  assert.match(signOut, /await writeSignOut\(\)/)

  const browser = templateText("modules/db/browser.ts")
  assert.match(browser, /export const createBrowserDbClient/)
  assert.doesNotMatch(browser, /auth\.signOut/)

  const refresh = templateText("hooks/auth/useAuthRefresh.ts")
  assert.match(refresh, /createBrowserDbClient\(\)\.auth\.onAuthStateChange\(\(\) => router\.refresh\(\)\)/)
  assert.match(refresh, /subscription\.unsubscribe\(\)/)
  assert.match(templateText("app/[locale]/providers.tsx"), /useAuthRefresh\(\)/)
})
