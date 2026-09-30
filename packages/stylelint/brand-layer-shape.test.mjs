import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file = FILES.brand) => lintRule("brand-layer-shape", code, file)

test("accepts a light block and a dark block with the same tokens", async () => {
  const code = `
:root { color-scheme: light; --accent: #7547ff; --background: oklch(97% 0 0); }
.dark { color-scheme: dark; --accent: #9b7bff; --background: oklch(20% 0 0); }
`
  assert.deepEqual(await rule(code), [])
})

test("accepts the dark block as a media query or a data-theme selector", async () => {
  assert.deepEqual(await rule(":root { --accent: #fff; } @media (prefers-color-scheme: dark) { :root { --accent: #000; } }"), [])
  assert.deepEqual(await rule(':root { --accent: #fff; } [data-theme="dark"] { --accent: #000; }'), [])
})

test("refuses a file with no dark block", async () => {
  const warnings = await rule(":root { --accent: #fff; }")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /no dark block/)
})

test("refuses a token that has one theme only, either way round", async () => {
  const dropped = await rule(":root { --accent: #fff; --muted: #888; } .dark { --accent: #000; }")
  assert.equal(dropped.length, 1)
  assert.match(dropped[0].text, /--muted.*no dark value/)
  const added = await rule(":root { --accent: #fff; } .dark { --accent: #000; --muted: #888; }")
  assert.equal(added.length, 1)
  assert.match(added[0].text, /--muted.*no light value/)
})

test("refuses a token the grammar does not publish", async () => {
  const warnings = await rule(":root { --nv-ink: #fff; } .dark { --nv-ink: #000; --accent: #111; } :root { --accent: #eee; }")
  assert.equal(warnings.length, 2)
  assert.match(warnings[0].text, /--nv-ink.*not a token the grammar publishes/)
})

test("refuses a selector, a property or an at-rule that is not the brand layer", async () => {
  assert.equal((await rule(".card { --accent: #fff; } :root { --accent: #fff; } .dark { --accent: #000; }")).length, 1)
  assert.equal((await rule(":root { color: red; --accent: #fff; } .dark { --accent: #000; }")).length, 1)
  assert.equal((await rule("@import \"x.css\"; :root { --accent: #fff; } .dark { --accent: #000; }")).length, 1)
})

test("only judges brand.css", async () => {
  assert.deepEqual(await rule(".card { color: red; }", FILES.module), [])
  assert.deepEqual(await rule(":root { --nv-ink: #fff; }", FILES.globals), [])
})

const FAMILY = '.grammar-common-root[data-grammar-family="offset-pop"]'

test("accepts the grammar family root as the light and the dark scope, and the system block in the media query", async () => {
  const code = `
${FAMILY} { --offset-pop-accent: oklch(68% 0.255 352); --offset-pop-danger: oklch(55% 0.18 37.78); }
${FAMILY}[data-grammar-theme="dark"] { --offset-pop-accent: oklch(68% 0.255 352); --offset-pop-danger: oklch(80% 0.13 37.78); }
@media (prefers-color-scheme: dark) {
  ${FAMILY}[data-grammar-theme="system"] { --offset-pop-accent: oklch(68% 0.255 352); --offset-pop-danger: oklch(80% 0.13 37.78); }
}
`
  assert.deepEqual(await rule(code), [])
})

test("accepts the family root with a .dark class or an ancestor .dark as the dark scope", async () => {
  assert.deepEqual(await rule(`${FAMILY} { --offset-pop-accent: #fff; } ${FAMILY}.dark { --offset-pop-accent: #000; }`), [])
  assert.deepEqual(await rule(`${FAMILY}[data-grammar-theme="light"] { --offset-pop-accent: #fff; } .dark ${FAMILY} { --offset-pop-accent: #000; }`), [])
})

test("a family-root brand still needs the same token set in light and dark", async () => {
  const warnings = await rule(`${FAMILY} { --offset-pop-accent: #fff; --offset-pop-danger: #f00; } ${FAMILY}[data-grammar-theme="dark"] { --offset-pop-accent: #000; }`)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /--offset-pop-danger.*no dark value/)
})

test("a family-root selector with anything else attached is still not the brand layer", async () => {
  const warnings = await rule(`${FAMILY} .card { --offset-pop-accent: #fff; } ${FAMILY}[data-grammar-theme="dark"] { --offset-pop-accent: #000; }`)
  // The rejected block sets nothing, so the dark block's token also has no light value.
  assert.equal(warnings.length, 2)
  assert.match(warnings[0].text, /in brand\.css/)
  assert.match(warnings[1].text, /--offset-pop-accent.*no light value/)
  const bare = await rule(`.grammar-common-root { --offset-pop-accent: #fff; } .dark { --offset-pop-accent: #000; }`)
  assert.equal(bare.length, 2)
  assert.match(bare[0].text, /in brand\.css/)
})

test("a compound selector of light and dark scopes is one block that counts for both themes", async () => {
  const code = `
:root, .light { --accent: #fff; }
.dark { --accent: #000; }
:root,
.light,
.dark { --success-soft: color-mix(in oklab, var(--success) 15%, transparent); --success-soft-foreground: var(--success); }
`
  assert.deepEqual(await rule(code), [])
})

test("a shared block does not excuse a token the other block lacks", async () => {
  const warnings = await rule(":root, .light { --accent: #fff; --muted: #888; } .dark { --accent: #000; }")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /--muted.*no dark value/)
})

test("a compound selector with one selector that is no theme scope is still refused", async () => {
  const warnings = await rule(":root, .card, .dark { --accent: #fff; } :root { --accent: #fff; } .dark { --accent: #000; }")
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /in brand\.css/)
})

test("accepts the soft pair of every status tone, info included", async () => {
  const tones = ["success", "warning", "danger", "info"]
  const block = tones.flatMap((tone) => [`--${tone}-soft: #eee;`, `--${tone}-soft-foreground: #111;`, `--${tone}-soft-hover: #ddd;`]).join(" ")
  assert.deepEqual(await rule(`:root { ${block} } .dark { ${block} }`), [])
})
