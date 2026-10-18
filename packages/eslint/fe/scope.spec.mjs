// proves: FE_CALLBACK_SHAPE@lite FE_CALLBACK_SHAPE@full
/** Real import targets determine ownership; virtual rule inputs keep their declared path ownership. */
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"
import { appDeclaration } from "../be/fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { classifyImport } from "./lib/scope.mjs"

const setup = (t, edition) => {
  const root = mkdtempSync(join(tmpdir(), "fe-import-owner-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const declaration = appDeclaration("fe", { apps: [{ name: "web", kind: "next" }] })
  declaration.edition = edition
  const hfs = hfsFromDeclaration(declaration, root)
  const context = { filename: join(root, "apps/web/src/app/auth/callback/route.ts"), settings: { starci: { hfs } } }
  const write = (file) => {
    const target = join(root, "apps/web/src", file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, "export const fixture = true\n")
  }
  return { context, write }
}

for (const edition of ["lite", "full"]) {
  test(`${edition} classifies an existing public auth barrel instead of a hypothetical module file`, (t) => {
    const { context, write } = setup(t, edition)
    write("modules/auth/index.ts")
    assert.equal(classifyImport(context, "@/modules/auth")?.slot, "fe.modules.auth")
    assert.equal(classifyImport(context, "../../../modules/auth")?.slot, "fe.modules.auth")
    assert.equal(classifyImport(context, "@/modules/auth/index.ts")?.slot, "fe.modules.auth")
  })

  test(`${edition} preserves explicit files and file-before-directory resolution`, (t) => {
    const { context, write } = setup(t, edition)
    write("modules/auth.ts")
    write("modules/auth/index.ts")
    write("modules/auth/recovery.tsx")
    assert.equal(classifyImport(context, "@/modules/auth")?.slot, "fe.modules")
    assert.equal(classifyImport(context, "@/modules/auth.ts")?.slot, "fe.modules")
    assert.equal(classifyImport(context, "@/modules/auth/recovery.tsx")?.slot, "fe.modules.auth")
    assert.equal(classifyImport(context, "@/modules/auth/recovery")?.slot, "fe.modules.auth")
  })

  test(`${edition} keeps wrong-owner isolation and existing virtual input classification`, (t) => {
    const { context, write } = setup(t, edition)
    write("modules/config/index.ts")
    assert.equal(classifyImport(context, "@/modules/config")?.slot, "fe.modules.config")
    assert.equal(classifyImport(context, "@/modules/auth/server")?.slot, "fe.modules.auth")
    assert.equal(classifyImport(context, "next/server"), null)
  })
}
