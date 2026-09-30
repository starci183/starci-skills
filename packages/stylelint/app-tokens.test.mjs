import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"
import { loadAppTokens, starciStylelintConfig } from "./index.mjs"

const made = []
test.after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

/** A repository with the given files (path -> text); returns the URL of its stylelint.config.mjs. */
const repo = (files) => {
  const dir = mkdtempSync(join(tmpdir(), "app-tokens-"))
  made.push(dir)
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(dir, file, ".."), { recursive: true })
    writeFileSync(join(dir, file), text)
  }
  return pathToFileURL(join(dir, "stylelint.config.mjs")).href
}

test("the app tokens are the custom properties the globals.css of every app and package declares, sorted, once", () => {
  const url = repo({
    "apps/web/src/app/globals.css": ":root { --page-ink: var(--grammar-ink); --page-x: var(--grammar-page-inset); }\n.dark { --page-ink: var(--grammar-ink-dark); }\n",
    "apps/admin/src/app/globals.css": "@theme { --admin-gap: var(--grammar-gap-2); }\n",
    "packages/kit-ui/src/styles/globals.css": ":root { --kit-edge: var(--grammar-edge); }\n",
  })
  assert.deepEqual(loadAppTokens(url), ["--admin-gap", "--kit-edge", "--page-ink", "--page-x"])
  assert.deepEqual(starciStylelintConfig({ appTokens: loadAppTokens(url) }).rules["starci/token-only"][1].appTokens, ["--admin-gap", "--kit-edge", "--page-ink", "--page-x"])
})

test("a custom property of another stylesheet, a comment, a var() reference and a build folder are not app tokens", () => {
  const url = repo({
    "apps/web/src/app/globals.css": "/* --commented: 1 */\n:root { --real: var(--grammar-ink); }\n",
    "apps/web/src/components/leaf.css": ":root { --local: 1rem; }\n",
    "apps/web/src/modules/brand/brand.css": ":root { --accent: red; }\n",
    "apps/web/.next/src/globals.css": ":root { --built: 1; }\n",
    "docs/src/globals.css": ":root { --outside: 1; }\n",
  })
  assert.deepEqual(loadAppTokens(url), ["--real"])
})

test("a grammar token declared in globals.css is left out, so no-token-redefinition stays its only judge; an empty repository has none", () => {
  assert.deepEqual(loadAppTokens(repo({ "apps/web/src/app/globals.css": ":root { --accent: var(--grammar-ink); --grammar-x: 1; --mine: var(--grammar-ink); }\n" })), ["--mine"])
  assert.deepEqual(loadAppTokens(repo({ "README.md": "x" })), [])
})
