import assert from "node:assert/strict"
import test from "node:test"
import { FILES, lintRule } from "./testing.mjs"

const rule = (code, file = FILES.brand) => lintRule("status-contrast", code, file)

/** A complete, conforming brand layer of the core family, modelled on starci-next-fe's brand.css. */
const CONFORMING = `
:root,
.light {
  color-scheme: light;
  --starci-core-canvas: oklch(97.02% 0.0015 354.13);
  --starci-core-foreground: oklch(21.03% 0.0015 354.13);
  --starci-core-success: oklch(73.29% 0.1941 162.85);
  --starci-core-success-foreground: oklch(21.03% 0.0059 162.85);
  --starci-core-warning: oklch(78.19% 0.159 84.37);
  --starci-core-warning-foreground: oklch(21.03% 0.0059 84.37);
  --starci-core-danger: oklch(62% 0.2335 37.78);
  --starci-core-danger-foreground: oklch(99.11% 0 0);
  --starci-core-info: oklch(72% 0.17 250);
  --starci-core-info-foreground: oklch(21.03% 0.0059 250);
}

.dark {
  color-scheme: dark;
  --starci-core-canvas: oklch(15% 0.0015 354.13);
  --starci-core-foreground: oklch(97.5% 0.0015 354.13);
  --starci-core-success: oklch(73.29% 0.1941 162.85);
  --starci-core-success-foreground: oklch(21.03% 0.0059 162.85);
  --starci-core-warning: oklch(82.03% 0.1392 88.38);
  --starci-core-warning-foreground: oklch(21.03% 0.0059 88.38);
  --starci-core-danger: oklch(70% 0.17 36.67);
  --starci-core-danger-foreground: oklch(21.03% 0.0059 36.67);
  --starci-core-info: oklch(72% 0.17 250);
  --starci-core-info-foreground: oklch(21.03% 0.0059 250);
}

:root,
.light,
.dark {
  --success-soft: color-mix(in oklab, var(--starci-core-success) 15%, transparent);
  --success-soft-foreground: color-mix(in oklab, var(--starci-core-success) 80%, var(--starci-core-foreground) 60%);
  --warning-soft: color-mix(in oklab, var(--starci-core-warning) 15%, transparent);
  --warning-soft-foreground: color-mix(in oklab, var(--starci-core-warning) 80%, var(--starci-core-foreground) 70%);
  --danger-soft: color-mix(in oklab, var(--starci-core-danger) 15%, transparent);
  --danger-soft-foreground: color-mix(in oklab, var(--starci-core-danger) 70%, var(--starci-core-foreground) 40%);
  --info-soft: color-mix(in oklab, var(--starci-core-info) 15%, transparent);
  --info-soft-foreground: color-mix(in oklab, var(--starci-core-info) 60%, var(--starci-core-foreground) 40%);
}

.dark {
  --danger-soft-foreground: color-mix(in oklab, var(--starci-core-danger) 80%, var(--starci-core-foreground) 30%);
}
`

/** The conforming layer with one text replaced, which must exist (a test that edits nothing proves nothing). */
const edit = (from, to) => {
  assert.ok(CONFORMING.includes(from), `fixture has no ${from}`)
  return CONFORMING.replace(from, to)
}

test("passes a complete soft-pair brand layer, where a shared block counts for both themes", async () => {
  assert.deepEqual(await rule(CONFORMING), [])
  assert.deepEqual(await lintRule("brand-layer-shape", CONFORMING, FILES.brand), [])
})

test("passes a brand that leaves the derived tones to the grammar and writes the semantic tokens itself", async () => {
  const code = `
:root { --background: oklch(97% 0.0015 354); --foreground: oklch(21% 0.0015 354); --success: oklch(73% 0.19 162); --warning: oklch(78% 0.16 84); --danger: oklch(55% 0.2 30); --info: oklch(72% 0.17 250);
  --info-soft: color-mix(in oklab, var(--info) 15%, transparent); --info-soft-foreground: color-mix(in oklab, var(--info) 50%, var(--foreground) 50%); }
.dark { --background: oklch(15% 0.0015 354); --foreground: oklch(97% 0.0015 354); --success: oklch(73% 0.19 162); --warning: oklch(82% 0.14 88); --danger: oklch(70% 0.17 36); --info: oklch(72% 0.17 250);
  --info-soft: color-mix(in oklab, var(--info) 12%, transparent); --info-soft-foreground: color-mix(in oklab, var(--info) 50%, var(--foreground) 50%); }
`
  assert.deepEqual(await rule(code), [])
})

test("passes hex, rgb() and hsl() values and a family-root scope", async () => {
  const code = `
.grammar-common-root[data-grammar-family="offset-pop"] {
  --background: #f7f4ef; --foreground: rgb(20 20 20); --success: hsl(150 60% 30%); --warning: #9a6700; --danger: #b3261e; --info: #0b57d0;
  --success-soft: hsl(150 60% 30% / 0.14); --success-soft-foreground: hsl(150 60% 20%);
  --warning-soft: #9a670024; --warning-soft-foreground: #5c3d00;
  --danger-soft: rgb(179 38 30 / 14%); --danger-soft-foreground: #7a1a14;
  --info-soft: rgba(11, 87, 208, 0.14); --info-soft-foreground: #0a3a8a;
}
.grammar-common-root[data-grammar-family="offset-pop"][data-grammar-theme="dark"] {
  --background: #1b1a17; --foreground: #f5f2ec; --success: #6ee7a0; --warning: #f0c060; --danger: #ff8a80; --info: #8ab4f8;
  --success-soft: rgb(110 231 160 / 14%); --success-soft-foreground: #b8f5d0;
  --warning-soft: rgb(240 192 96 / 14%); --warning-soft-foreground: #f8dd9c;
  --danger-soft: rgb(255 138 128 / 14%); --danger-soft-foreground: #ffc9c4;
  --info-soft: rgb(138 180 248 / 14%); --info-soft-foreground: #c6dbfc;
}
`
  assert.deepEqual(await rule(code), [])
})

test("refuses a solid status tone used as the soft foreground when it does not reach 4.5:1", async () => {
  // nivo-fe's darkened solid success (58% lightness) is 3.81:1 on white.
  const code = edit(
    "--success-soft-foreground: color-mix(in oklab, var(--starci-core-success) 80%, var(--starci-core-foreground) 60%);",
    "--success-soft-foreground: var(--starci-core-success);",
  ).replace("--starci-core-canvas: oklch(97.02% 0.0015 354.13);", "--starci-core-canvas: oklch(100% 0 0);").replace("--starci-core-success: oklch(73.29% 0.1941 162.85);", "--starci-core-success: oklch(58% 0.16 162.85);")
  const warnings = await rule(code)
  const light = warnings.filter((warning) => /in light/.test(warning.text))
  assert.equal(light.length, 1)
  assert.match(light[0].text, /`--success-soft-foreground` is the solid `--success` in light and reads 3\.\d\d:1, under 4\.5:1/)
})

test("passes a solid tone as the soft foreground when it does reach 4.5:1", async () => {
  const code = edit(
    "--success-soft-foreground: color-mix(in oklab, var(--starci-core-success) 80%, var(--starci-core-foreground) 60%);",
    "--success-soft-foreground: var(--starci-core-success);",
  ).replace(/--starci-core-success: oklch\(73\.29% 0\.1941 162\.85\);/g, "--starci-core-success: oklch(40% 0.1 162.85);")
  const warnings = (await rule(code)).filter((warning) => /light/.test(warning.text) && /success/.test(warning.text))
  assert.deepEqual(warnings, [])
})

test("refuses a soft foreground under 3:1 on its tint and on the page", async () => {
  const code = edit(
    "--warning-soft-foreground: color-mix(in oklab, var(--starci-core-warning) 80%, var(--starci-core-foreground) 70%);",
    "--warning-soft-foreground: oklch(85% 0.12 84);",
  )
  const warnings = await rule(code)
  const light = warnings.filter((warning) => /in light/.test(warning.text))
  assert.equal(light.length, 2)
  assert.match(light[0].text, /`--warning-soft-foreground` on `--warning-soft` is 1\.\d\d:1 in light, under 3:1/)
  assert.match(light[1].text, /`--warning-soft-foreground` on `--background` is 1\.\d\d:1 in light, under 3:1/)
})

test("judges each theme on its own: a dark-only failure names dark", async () => {
  const code = edit(
    "--danger-soft-foreground: color-mix(in oklab, var(--starci-core-danger) 80%, var(--starci-core-foreground) 30%);",
    "--danger-soft-foreground: oklch(30% 0.1 36);",
  )
  const warnings = await rule(code)
  assert.ok(warnings.length >= 1)
  for (const warning of warnings) assert.match(warning.text, /in dark/)
})

test("refuses body text under 4.5:1 on the page", async () => {
  const code = edit("--starci-core-foreground: oklch(21.03% 0.0015 354.13);", "--starci-core-foreground: oklch(70% 0.0015 354.13);")
  const warnings = (await rule(code)).filter((warning) => /`--foreground` on `--background`/.test(warning.text))
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /is 2\.\d\d:1 in light, under 4\.5:1/)
})

test("refuses a soft token that one theme declares and the other does not", async () => {
  const code = `
:root { --background: oklch(97% 0 0); --foreground: oklch(21% 0 0); --danger-soft: color-mix(in oklab, var(--danger) 15%, transparent); }
.dark { --background: oklch(15% 0 0); --foreground: oklch(97% 0 0); }
`
  const warnings = (await rule(code)).filter((warning) => /declared for/.test(warning.text))
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /`--danger-soft` is declared for light and not for dark/)
  const reverse = (await rule(code.replace(":root { --background", ".light { --background").replace(".dark { --background: oklch(15% 0 0); --foreground: oklch(97% 0 0); }", ".dark { --background: oklch(15% 0 0); --foreground: oklch(97% 0 0); --danger-soft-foreground: oklch(90% 0.05 30); }"))).filter((warning) => /declared for/.test(warning.text))
  assert.ok(reverse.some((warning) => /`--danger-soft-foreground` is declared for dark and not for light/.test(warning.text)))
})

test("refuses a tone that has no soft pair at all: the grammar derives none for info", async () => {
  const code = `
:root { --background: oklch(97% 0 0); --foreground: oklch(21% 0 0); --info: oklch(60% 0.15 250); }
.dark { --background: oklch(15% 0 0); --foreground: oklch(97% 0 0); --info: oklch(72% 0.15 250); }
`
  const warnings = await rule(code)
  assert.equal(warnings.length, 2)
  assert.match(warnings[0].text, /`--info-soft` has no value; the info tone has no soft pair in light/)
  assert.match(warnings[1].text, /in dark/)
})

test("refuses a value it cannot resolve instead of passing it", async () => {
  const relative = edit("--info-soft-foreground: color-mix(in oklab, var(--starci-core-info) 60%, var(--starci-core-foreground) 40%);", "--info-soft-foreground: oklch(from var(--starci-core-info) 30% c h);")
  assert.match((await rule(relative))[0].text, /not a colour this check reads/)
  const dangling = edit("--success-soft: color-mix(in oklab, var(--starci-core-success) 15%, transparent);", "--success-soft: color-mix(in oklab, var(--nowhere) 15%, transparent);")
  assert.match((await rule(dangling))[0].text, /needs `--nowhere`, which has no value/)
  const keyword = edit("--starci-core-canvas: oklch(97.02% 0.0015 354.13);", "--starci-core-canvas: currentcolor;")
  assert.match((await rule(keyword))[0].text, /`--background` is `currentcolor`, which is not a colour this check reads/)
})

test("refuses a translucent page background, which nothing can be composited on", async () => {
  const code = edit("--starci-core-canvas: oklch(97.02% 0.0015 354.13);", "--starci-core-canvas: oklch(97% 0 0 / 50%);")
  assert.match((await rule(code))[0].text, /`--background` is not opaque/)
})

test("refuses a brand layer that writes tokens of two families", async () => {
  const warnings = await rule(`${CONFORMING}\n:root { --offset-pop-accent: #fff; }\n.dark { --offset-pop-accent: #000; }`)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /more than one grammar family \(core, offset-pop\)/)
})

test("only judges brand.css", async () => {
  const broken = ":root { --foreground: oklch(70% 0 0); }"
  assert.deepEqual(await rule(broken, FILES.globals), [])
  assert.deepEqual(await rule(broken, FILES.css), [])
})
