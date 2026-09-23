/**
 * WCAG contrast of the colours a Grammar root ACTUALLY resolves, in light and dark.
 *
 * A family sheet declares custom properties on its `.grammar-common-root[data-grammar-family]`
 * scope; HeroUI declares its own on `:root`. A property the scope does not declare is INHERITED
 * from `:root` already substituted there, so a HeroUI mix such as `--accent-soft` computed from
 * HeroUI's own blue stays blue under a violet family, and HeroUI's light `--default` stays light
 * under a dark scope. That is the defect this helper models: it resolves the scope exactly as the
 * cascade does (HeroUI `:root` values inherited as finished values, Common's layer under the
 * family's layer, the dark block over the light one) and measures the pairs the CSS combines.
 *
 * It lives under `src/__test__/` and is excluded from `tsconfig.build.json`.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

export type Theme = "light" | "dark"
export type Family = "common" | "core" | "heritage" | "offset-pop"
type Rgba = { readonly r: number; readonly g: number; readonly b: number; readonly a: number }
type Block = { readonly selector: string; readonly at: ReadonlyArray<string>; readonly body: string }

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

/** Leaf rules with the at-rule preludes that wrap them (`@layer` included). */
export const cssBlocks = (css: string): ReadonlyArray<Block> => {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, "")
    const blocks: Array<Block> = []
    const stack: Array<{ prelude: string; start: number }> = []
    let cursor = 0
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        if (character === ";" && stack.length === 0) cursor = index + 1
        if (character === "{") {
            stack.push({ prelude: source.slice(cursor, index).trim(), start: index + 1 })
            cursor = index + 1
            continue
        }
        if (character !== "}") continue
        const open = stack.pop()
        if (open === undefined) continue
        const body = source.slice(open.start, index)
        if (!body.includes("{") && !open.prelude.startsWith("@")) {
            blocks.push({ selector: open.prelude.replace(/\s+/g, " "), at: stack.map((entry) => entry.prelude), body })
        }
        cursor = index + 1
    }
    return blocks
}

/** Custom-property declarations in source order (a repeated name keeps the later value, as the cascade does). */
export const customProperties = (body: string): Map<string, string> =>
    new Map(Array.from(body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g), (m) => [m[1] ?? "", (m[2] ?? "").replace(/\s+/g, " ").trim()]))

const inMedia = (block: Block) => block.at.some((prelude) => prelude.startsWith("@media"))

/* ------------------------------------------------------------------ HeroUI :root */

let heroUiSource: string | undefined
const heroUiCss = () => (heroUiSource ??= read("node_modules/@heroui/styles/dist/heroui.min.css"))

let heroUiRootCache: Map<string, string> | undefined
/** HeroUI's light `:root` theme, merged in source order: what every scope inherits. */
export const heroUiRoot = (): Map<string, string> => {
    if (heroUiRootCache !== undefined) return heroUiRootCache
    const merged = new Map<string, string>()
    heroUiRootCache = merged
    for (const block of cssBlocks(heroUiCss())) {
        if (inMedia(block)) continue
        const parts = block.selector.split(",").map((part) => part.trim())
        if (!parts.includes(":root")) continue
        for (const [name, value] of customProperties(block.body)) merged.set(name, value)
    }
    return merged
}

/**
 * The HeroUI THEME variables: every custom property HeroUI's light or dark theme block declares
 * and its compiled component CSS reads. These are the variables a scoped family must re-declare,
 * because each one otherwise arrives from `:root` already resolved for HeroUI's own light theme.
 */
export const heroUiThemeVariables = (): ReadonlyArray<string> => {
    const css = heroUiCss()
    const themed = new Set<string>()
    for (const block of cssBlocks(css)) {
        if (inMedia(block)) continue
        if (!/(?:^|,)\s*(?:\.dark|\[data-theme=dark\])\s*(?:,|$)/.test(block.selector)) continue
        for (const name of customProperties(block.body).keys()) themed.add(name)
    }
    // Hues `:root,:host` declares once for both themes instead of in each theme block.
    for (const block of cssBlocks(css)) {
        if (block.selector !== ":root,:host" || inMedia(block)) continue
        for (const name of customProperties(block.body).keys()) {
            if (/^--(?:accent|success)(?:-foreground)?$|^--field-border$/.test(name)) themed.add(name)
        }
    }
    const read = new Set(Array.from(css.matchAll(/var\((--[a-z0-9-]+)/g), (m) => m[1] ?? ""))
    return [...themed].filter((name) => read.has(name) && !/^--scrollbar-(?:gutter|width)$/.test(name)).sort()
}

/* ------------------------------------------------------------------ scope model */

const FAMILY_SHEETS: Readonly<Record<Family, ReadonlyArray<string>>> = {
    common: ["src/common/styles.css"],
    core: ["src/common/styles.css", "src/core/styles.css"],
    heritage: ["src/common/styles.css", "src/heritage/styles.css"],
    "offset-pop": ["src/common/styles.css", "src/offset-pop/styles.css"],
}

const scopeSelector = (family: Family | null) =>
    family === null ? ".grammar-common-root" : `.grammar-common-root[data-grammar-family="${family}"]`

/** Declarations of one exact scope selector, optionally inside one media prelude. */
const scopeBlock = (css: string, selector: string, media?: string): Map<string, string> => {
    const merged = new Map<string, string>()
    for (const block of cssBlocks(css)) {
        const medias = block.at.filter((prelude) => prelude.startsWith("@media"))
        if (media === undefined ? medias.length > 0 : !(medias.length === 1 && medias[0] === media)) continue
        if (!block.selector.split(",").map((part) => part.trim()).includes(selector)) continue
        for (const [name, value] of customProperties(block.body)) merged.set(name, value)
    }
    return merged
}

export type Scope = {
    readonly family: Family
    readonly theme: Theme
    /** What the scope element declares itself, after the cascade. */
    readonly own: ReadonlyMap<string, string>
    /** HeroUI's `:root`, already resolved there. */
    readonly inherited: ReadonlyMap<string, string>
}

const DARK = "@media (prefers-color-scheme: dark)"

/** The scope blocks of each layer in cascade order: Common's, then the family's. */
const layers = (family: Family, variant: "light" | "dark" | "system") => {
    const sheets = FAMILY_SHEETS[family].map(read)
    const common = sheets[0] ?? ""
    const own = family === "common" ? [] : [sheets.at(-1) ?? ""]
    const scoped = (css: string, fam: Family | null) => {
        const base = scopeSelector(fam)
        const light = scopeBlock(css, base)
        if (variant === "light") return [light]
        if (variant === "dark") return [light, scopeBlock(css, `${base}[data-grammar-theme="dark"]`)]
        return [light, scopeBlock(css, `${base}[data-grammar-theme="system"]`, DARK)]
    }
    return [...scoped(common, null), ...own.flatMap((css) => scoped(css, family))]
}

export const scopeOf = (family: Family, theme: Theme, variant: "light" | "dark" | "system" = theme): Scope => {
    const own = new Map<string, string>()
    for (const layer of layers(family, variant)) for (const [name, value] of layer) own.set(name, value)
    const root = heroUiRoot()
    const inherited = new Map<string, string>()
    for (const name of root.keys()) inherited.set(name, substitute(root.get(name) ?? "", root, new Map(), new Set([name])))
    return { family, theme, own, inherited }
}

/** Every property the dark and the system-dark blocks each set, per layer (they must be equal). */
export const darkAndSystemBlocks = (family: Family) => ({ dark: layers(family, "dark"), system: layers(family, "system") })

/* ------------------------------------------------------------------ var() substitution */

const splitTopLevel = (value: string, separator: string): Array<string> => {
    const parts: Array<string> = []
    let depth = 0
    let start = 0
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index]
        if (character === "(") depth += 1
        else if (character === ")") depth -= 1
        else if (character === separator && depth === 0) {
            parts.push(value.slice(start, index))
            start = index + 1
        }
    }
    parts.push(value.slice(start))
    return parts.map((part) => part.trim())
}

const substitute = (value: string, own: ReadonlyMap<string, string>, inherited: ReadonlyMap<string, string>, seen: Set<string>): string => {
    let output = ""
    let index = 0
    while (index < value.length) {
        const start = value.indexOf("var(", index)
        if (start === -1) {
            output += value.slice(index)
            break
        }
        output += value.slice(index, start)
        let depth = 0
        let end = start + 3
        for (; end < value.length; end += 1) {
            if (value[end] === "(") depth += 1
            else if (value[end] === ")") {
                depth -= 1
                if (depth === 0) break
            }
        }
        const inner = value.slice(start + 4, end)
        const comma = splitTopLevel(inner, ",")
        const name = (comma[0] ?? "").trim()
        const fallback = comma.length > 1 ? comma.slice(1).join(",").trim() : undefined
        let resolved: string | undefined
        if (own.has(name) && !seen.has(name)) {
            resolved = substitute(own.get(name) ?? "", own, inherited, new Set([...seen, name]))
        } else if (inherited.has(name)) {
            resolved = inherited.get(name)
        }
        if (resolved === undefined || resolved === "") resolved = fallback === undefined ? "" : substitute(fallback, own, inherited, seen)
        output += resolved
        index = end + 1
    }
    return output.trim()
}

/** The scope's value for a property, fully substituted. */
export const valueOf = (scope: Scope, name: string): string =>
    substitute(`var(${name})`, scope.own, scope.inherited, new Set())

/** Where a property comes from in this scope: its own declaration, or HeroUI's `:root`. */
export const sourceOf = (scope: Scope, name: string): "scope" | "root" | "none" =>
    scope.own.has(name) ? "scope" : scope.inherited.has(name) ? "root" : "none"

/* ------------------------------------------------------------------ colour */

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const clamp = (c: number) => Math.min(1, Math.max(0, c))

type Lab = readonly [number, number, number]

const oklabToRgb = ([L, a, b]: Lab): readonly [number, number, number] => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    return [
        clamp(toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
        clamp(toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
        clamp(toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
    ]
}

const rgbToOklab = (r: number, g: number, b: number): Lab => {
    const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)]
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ]
}

const number = (token: string, percentScale = 1) =>
    token.endsWith("%") ? (parseFloat(token) / 100) * percentScale : parseFloat(token)

const NAMED: Readonly<Record<string, Rgba>> = {
    white: { r: 1, g: 1, b: 1, a: 1 },
    black: { r: 0, g: 0, b: 0, a: 1 },
    transparent: { r: 0, g: 0, b: 0, a: 0 },
}

const mixIn = (space: string, first: Rgba, second: Rgba, p: number): Rgba => {
    // Premultiplied interpolation, as CSS Color 4/5 specify for color-mix().
    const a = first.a * p + second.a * (1 - p)
    const toSpace = (c: Rgba): Lab => (space === "srgb" ? [c.r, c.g, c.b] : rgbToOklab(c.r, c.g, c.b))
    let one = toSpace(first)
    let two = toSpace(second)
    if (space === "oklch") {
        const polar = ([L, A, B]: Lab, other: Lab): Lab => {
            const chroma = Math.hypot(A, B)
            return [L, chroma, chroma < 1e-6 ? Math.atan2(other[2], other[1]) : Math.atan2(B, A)]
        }
        const p1 = polar(one, two)
        const p2 = polar(two, one)
        let h2 = p2[2]
        if (h2 - p1[2] > Math.PI) h2 -= 2 * Math.PI
        if (p1[2] - h2 > Math.PI) h2 += 2 * Math.PI
        one = [p1[0], p1[1] * Math.cos(p1[2]), p1[1] * Math.sin(p1[2])]
        const hue = p1[2] * p + h2 * (1 - p)
        const L = (p1[0] * first.a * p + p2[0] * second.a * (1 - p)) / (a || 1)
        const C = (p1[1] * first.a * p + p2[1] * second.a * (1 - p)) / (a || 1)
        const [r, g, b] = oklabToRgb([L, C * Math.cos(hue), C * Math.sin(hue)])
        return { r, g, b, a }
    }
    const channels = [0, 1, 2].map((i) => ((one[i] ?? 0) * first.a * p + (two[i] ?? 0) * second.a * (1 - p)) / (a || 1)) as unknown as Lab
    if (space === "srgb") return { r: channels[0], g: channels[1], b: channels[2], a }
    const [r, g, b] = oklabToRgb(channels)
    return { r, g, b, a }
}

/** A resolved CSS colour value as sRGB (gamut clipped), or null when it is not a colour. */
export const parseColor = (input: string): Rgba | null => {
    const value = input.trim().toLowerCase()
    if (value in NAMED) return NAMED[value] ?? null
    if (value.startsWith("#")) {
        const hex = value.slice(1)
        const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex
        const at = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255
        return { r: at(0), g: at(2), b: at(4), a: full.length === 8 ? at(6) : 1 }
    }
    const fn = value.match(/^([a-z-]+)\((.*)\)$/)
    if (fn === null) return null
    const [, name, args = ""] = fn
    if (name === "rgb" || name === "rgba") {
        const parts = args.replace(/\//g, " ").split(/[\s,]+/).filter(Boolean)
        const channel = (t: string) => (t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t) / 255)
        return { r: channel(parts[0] ?? "0"), g: channel(parts[1] ?? "0"), b: channel(parts[2] ?? "0"), a: parts[3] === undefined ? 1 : number(parts[3]) }
    }
    if (name === "oklch" && args.startsWith("from ")) {
        // Relative colour: `oklch(from <colour> <l> <c> <h>)`, channels as keywords, numbers or `calc(1 - l)`.
        const rest = splitTopLevel(args.slice(5).trim(), " ").filter(Boolean)
        const source = parseColor(rest[0] ?? "")
        if (source === null) return null
        const lab = rgbToOklab(source.r, source.g, source.b)
        const channels = { l: lab[0], c: Math.hypot(lab[1], lab[2]), h: (Math.atan2(lab[2], lab[1]) * 180) / Math.PI }
        const channel = (token: string) => {
            if (token in channels) return channels[token as keyof typeof channels]
            const inverted = token.match(/^calc\(1 - ([lch])\)$/)
            if (inverted !== null) return 1 - channels[inverted[1] as keyof typeof channels]
            return parseFloat(token)
        }
        const [L, C, H] = [channel(rest[1] ?? "l"), channel(rest[2] ?? "c"), channel(rest[3] ?? "h")]
        const [r, g, b] = oklabToRgb([L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)])
        return { r, g, b, a: source.a }
    }
    if (name === "oklch" || name === "oklab") {
        const [color = "", alpha] = args.split("/").map((part) => part.trim())
        const parts = color.split(/\s+/)
        const L = number(parts[0] ?? "0")
        let lab: Lab
        if (name === "oklch") {
            const C = number(parts[1] ?? "0", 0.4)
            const h = ((parseFloat(parts[2] ?? "0") || 0) * Math.PI) / 180
            lab = [L, C * Math.cos(h), C * Math.sin(h)]
        } else {
            lab = [L, number(parts[1] ?? "0", 0.4), number(parts[2] ?? "0", 0.4)]
        }
        const [r, g, b] = oklabToRgb(lab)
        return { r, g, b, a: alpha === undefined ? 1 : number(alpha) }
    }
    if (name === "color-mix") {
        const parts = splitTopLevel(args, ",")
        const space = (parts[0] ?? "").replace(/^in\s+/, "").trim()
        const operand = (part: string) => {
            const match = part.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?)%)?$/)
            const colour = parseColor(match?.[1] ?? "")
            return { colour, weight: match?.[2] === undefined ? undefined : parseFloat(match[2]) / 100 }
        }
        const one = operand(parts[1] ?? "")
        const two = operand(parts[2] ?? "")
        if (one.colour === null || two.colour === null) return null
        let p1 = one.weight
        let p2 = two.weight
        if (p1 === undefined && p2 === undefined) [p1, p2] = [0.5, 0.5]
        else if (p1 === undefined) p1 = 1 - (p2 ?? 0)
        else if (p2 === undefined) p2 = 1 - p1
        const sum = (p1 ?? 0) + (p2 ?? 0)
        const mixed = mixIn(space, one.colour, two.colour, (p1 ?? 0) / sum)
        return sum < 1 ? { ...mixed, a: mixed.a * sum } : mixed
    }
    return null
}

const over = (top: Rgba, bottom: Rgba): Rgba => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
})

const luminance = (c: Rgba) => 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b)

export const ratio = (fg: Rgba, bg: Rgba) => {
    const [a, b] = [luminance(fg), luminance(bg)]
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export const hex = (c: Rgba) => `#${[c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`

/* ------------------------------------------------------------------ pairs */

/**
 * One foreground painted on one background. `under` is what shows through a translucent
 * background (a soft tint sits on a surface or the canvas). `min` is 4.5 for text and 3 for
 * non-text; the note names the rendered place that combines the two.
 */
export type Pair = { readonly fg: string; readonly bg: string; readonly under?: string; readonly min: number; readonly where: string }

const onGrounds = (fg: string, grounds: ReadonlyArray<string>, where: string, min = 4.5): Array<Pair> =>
    grounds.map((bg) => ({ fg, bg, min, where }))
const onSoft = (fg: string, soft: string, where: string): Array<Pair> =>
    ["--surface", "--background", "--overlay"].map((under) => ({ fg, bg: soft, under, min: 4.5, where }))

const alertTint = (tone: string) => `color-mix(in srgb, var(${tone}) 10%, var(--surface))`
const ALERT_TONES: ReadonlyArray<readonly [string, string | undefined]> = [
    ["--info", "--accent-soft-foreground"],
    ["--success", "--success-soft-foreground"],
    ["--warning", "--warning-soft-foreground"],
    ["--danger", "--danger-soft-foreground"],
    ["--accent", "--accent-soft-foreground"],
    ["--muted", undefined],
]

/** Page grounds text is set on directly. */
const GROUNDS = ["--background", "--surface", "--surface-secondary", "--surface-tertiary", "--overlay", "--field-background"]

/**
 * The pairs Common anatomy and HeroUI's compiled component CSS combine (see heroui.min.css:
 * `.button--secondary` sets `--button-fg: var(--accent-soft-foreground)` on `--default`,
 * `.badge--soft.badge--success` paints `--success-soft-foreground` on `--success-soft`, and so on).
 */
export const PAIRS: ReadonlyArray<Pair> = [
    ...onGrounds("--foreground", [...GROUNDS, "--default", "--segment"], "body text, labels, code on default"),
    { fg: "--surface-foreground", bg: "--surface", min: 4.5, where: "card, table cell" },
    { fg: "--surface-foreground", bg: "--surface-hover", min: 4.5, where: "hovered surface tag" },
    { fg: "--surface-secondary-foreground", bg: "--surface-secondary", min: 4.5, where: "secondary surface" },
    { fg: "--surface-tertiary-foreground", bg: "--surface-tertiary", min: 4.5, where: "tertiary surface" },
    { fg: "--overlay-foreground", bg: "--overlay", min: 4.5, where: "popover, menu, toast" },
    ...onGrounds("--muted", [...GROUNDS, "--default"], "description, kbd, close button, caption"),
    ...onSoft("--muted", "--accent-soft", "description inside a selected list option"),
    // Alert/Toast banner: `color-mix(in srgb, <tone> 10%, var(--surface))`, description in muted, title in the soft foreground.
    ...ALERT_TONES.map(([tone]) => ({ fg: "--muted", bg: alertTint(tone), min: 4.5, where: `Alert description, ${tone} tone` })),
    ...ALERT_TONES.filter(([, title]) => title !== undefined).map(([tone, title]) => ({ fg: title ?? "", bg: alertTint(tone), min: 4.5, where: `Alert title, ${tone} tone` })),
    ...onGrounds("--default-foreground", ["--default", "--default-hover", "--background", "--surface", "--overlay"], "tertiary, ghost and outline buttons, pagination, tag"),
    ...onGrounds("--segment-foreground", ["--segment"], "selected tab, segmented control"),
    ...onGrounds("--accent-soft-foreground", ["--default", "--default-hover", "--background", "--surface", "--overlay"], "secondary button, alert title, calendar nav"),
    ...onSoft("--accent-soft-foreground", "--accent-soft", "selected tag, today cell, soft badge, selected sidebar item"),
    ...onSoft("--accent-soft-foreground", "--accent-soft-hover", "hovered selected tag"),
    ...onGrounds("--accent-foreground", ["--accent", "--accent-hover"], "primary button, checked control"),
    ...onGrounds("--success-foreground", ["--success", "--success-hover"], "primary success chip"),
    ...onGrounds("--warning-foreground", ["--warning", "--warning-hover"], "primary warning chip"),
    ...onGrounds("--danger-foreground", ["--danger", "--danger-hover"], "danger button, invalid checked box"),
    ...onGrounds("--info-foreground", ["--info"], "primary info tone"),
    ...onSoft("--success-soft-foreground", "--success-soft", "soft success badge, alert title"),
    ...onSoft("--warning-soft-foreground", "--warning-soft", "soft warning badge, alert title"),
    ...onSoft("--danger-soft-foreground", "--danger-soft", "danger-soft button, soft danger badge"),
    ...onSoft("--default-soft-foreground", "--default-soft", "soft default badge"),
    ...onGrounds("--success-soft-foreground", ["--surface", "--overlay"], "success alert or toast title"),
    ...onGrounds("--warning-soft-foreground", ["--surface", "--overlay"], "warning alert or toast title"),
    ...onGrounds("--danger-soft-foreground", ["--surface", "--overlay"], "danger alert or toast title"),
    ...onGrounds("--field-foreground", ["--field-background", "--field-hover", "--field-focus"], "typed value"),
    ...onGrounds("--field-placeholder", ["--field-background", "--field-hover"], "placeholder, select value"),
    ...onGrounds("--link", ["--background", "--surface", "--surface-secondary"], "link, breadcrumb current, prose link"),
    ...onGrounds("--focus", ["--background", "--surface"], "focus ring (non-text)", 3),
]

export type Measured = Pair & { readonly theme: Theme; readonly ratio: number; readonly fgHex: string; readonly bgHex: string }

export const measure = (scope: Scope, pair: Pair): Measured => {
    const colour = (name: string) => {
        const value = name.startsWith("--") ? valueOf(scope, name) : substitute(name, scope.own, scope.inherited, new Set())
        const parsed = parseColor(value)
        if (parsed === null) throw new Error(`${scope.family}/${scope.theme}: ${name} does not resolve to a colour (${value})`)
        return parsed
    }
    const under = colour(pair.under ?? "--background")
    const base = colour("--background")
    const bg = over(colour(pair.bg), over(under, base))
    const fg = over(colour(pair.fg), bg)
    return { ...pair, theme: scope.theme, ratio: ratio(fg, bg), fgHex: hex(fg), bgHex: hex(bg) }
}

/* ------------------------------------------------------------------ tones painted as text */

export type Tone = "accent" | "danger"

const SOURCE_SHEETS = [
    "node_modules/@heroui/styles/dist/heroui.min.css",
    "src/common/styles.css",
    "src/common/components-forms.css",
    "src/common/components-navigation.css",
    "src/common/components-overlays.css",
]

/** Icons, rings, spinners and thumbs: non-text marks (1.4.11, 3:1), not text (1.4.3). */
const NON_TEXT = /spinner|progress|switch__thumb|indicator|timeline-marker/

/**
 * Every selector that paints a tone AS TEXT: a `color:` whose first `var()` is the tone (or, for
 * the accent, Core's own `--starci-core-accent`), in HeroUI's compiled CSS and Common's anatomy.
 * Read from the sheets, so a new vendor or Common rule joins the list without editing a spec.
 */
export const toneTextSelectors = (tone: Tone): ReadonlyArray<string> => {
    const names = tone === "accent" ? ["--accent", "--starci-core-accent"] : ["--danger"]
    const first = new RegExp(String.raw`(?:^|;)\s*color\s*:\s*var\((${names.join("|")})[,)]`)
    const selectors = new Set<string>()
    for (const path of SOURCE_SHEETS) {
        for (const block of cssBlocks(read(path))) {
            if (block.at.some((prelude) => prelude.startsWith("@media (forced-colors"))) continue
            if (!first.test(block.body)) continue
            for (const part of splitTopLevel(block.selector, ",")) if (!NON_TEXT.test(part)) selectors.add(part)
        }
    }
    return [...selectors]
}

/** The class a selector's text belongs to: the last class in it (a vendor BEM modifier counts). */
export const subjectClass = (selector: string): string => {
    const classes = Array.from(selector.matchAll(/\.([a-z][a-z0-9_-]*)/g), (m) => m[1] ?? "")
    return classes.at(-1) ?? ""
}

/**
 * How a family paints a tone as text. `var(--<tone>)` when the tone itself is text-safe; otherwise
 * the family re-declares the tone on each text element (`routes`) to a text-safe colour (`text`).
 */
export type ToneText = { readonly text: string; readonly routes?: { readonly sheets: ReadonlyArray<string>; readonly properties: ReadonlyArray<string> } }

/** The family's routing rules for a tone: selectors of rules that re-declare the tone property. */
export const routedClasses = (route: NonNullable<ToneText["routes"]>): ReadonlySet<string> => {
    const routed = new Set<string>()
    for (const path of route.sheets) {
        for (const block of cssBlocks(read(path))) {
            const declared = customProperties(block.body)
            if (!route.properties.some((property) => declared.has(property))) continue
            for (const match of block.selector.matchAll(/\.([a-z][a-z0-9_-]*)/g)) routed.add(match[1] ?? "")
        }
    }
    return routed
}

/** Text selectors of a tone the family's routing rules do not reach (a vendor BEM modifier is reached through its block). */
export const unroutedSelectors = (tone: Tone, route: NonNullable<ToneText["routes"]>): ReadonlyArray<string> => {
    const routed = routedClasses(route)
    return toneTextSelectors(tone).filter((selector) => {
        const subject = subjectClass(selector)
        return !routed.has(subject) && !routed.has(subject.split("--")[0] ?? "")
    })
}

/** Tone-as-text pairs: the family's text colour for the tone on every ground that text sits on. */
export const toneTextPairs = (tone: Tone, text: string): ReadonlyArray<Pair> => [
    ...onGrounds(text, ["--background", "--surface", "--surface-secondary", "--field-background", "--overlay"], `${tone} painted as text`),
    ...onGrounds(`var(--${tone})`, ["--background", "--surface"], `${tone} as an icon, spinner or ring (non-text)`, 3),
]

export const measureAll = (family: Family, theme: Theme, pairs: ReadonlyArray<Pair> = PAIRS) => {
    const scope = scopeOf(family, theme)
    return pairs.map((pair) => measure(scope, pair))
}
