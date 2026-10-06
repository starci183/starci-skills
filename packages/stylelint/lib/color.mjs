/**
 * Colour maths for `starci/status-contrast`: parse the notations a brand layer writes (hex, `rgb()`, `hsl()`,
 * `oklab()`, `oklch()`, `color-mix()` in oklab, oklch or srgb, `transparent`, `white`, `black`), and compute the
 * WCAG 2 contrast ratio with alpha composited on the background.
 *
 * A colour is `{ lab: [L, a, b], alpha, hue }`: OKLab is the one stored space (a mix in oklab, the grammar's own space,
 * is then exact); `hue` is the OKLCH hue in degrees when the value was written in OKLCH (so a polar mix keeps it) and
 * `null` otherwise. A value this module cannot read (relative colours, `currentcolor`, `light-dark()`, a space it does
 * not know) parses to `null`: the caller reports it, it never passes silently.
 */

const NAMED = { transparent: [0, 0, 0, 0], white: [1, 1, 1, 1], black: [0, 0, 0, 1] }
/** OKLCH chroma below which a colour that did not come from OKLCH has no hue of its own. */
const POWERLESS = 1e-4

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.abs(c) ** (1 / 2.4) - 0.055)
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value))

/** Gamma-encoded sRGB (0..1, unclamped) to OKLab. */
function srgbToOklab([red, green, blue]) {
  const [r, g, b] = [red, green, blue].map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLab to gamma-encoded sRGB (0..1, unclamped: an out-of-gamut colour keeps its overshoot). */
function oklabToSrgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLinear)
}

/** OKLab to OKLCH `[L, C, H]` with H in degrees. */
export const oklabToOklch = ([L, a, b]) => [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360]

/** OKLCH `[L, C, H]` to OKLab. */
export const oklchToOklab = ([L, C, H]) => [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)]

const fromSrgb = (rgb, alpha = 1) => ({ lab: srgbToOklab(rgb), alpha, hue: null })

// -- reading -----------------------------------------------------------------------------------------------------

/** Splits `text` at `separator` outside parentheses. */
function topLevel(text, separator) {
  const out = []
  let depth = 0
  let from = 0
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === "(") depth += 1
    else if (char === ")") depth -= 1
    else if (char === separator && depth === 0) {
      out.push(text.slice(from, i))
      from = i + 1
    }
  }
  out.push(text.slice(from))
  return out
}

/** The arguments of a function call as top-level words: `"58% .16 162.85 / 50%"` gives its parts and the alpha part. */
function splitArguments(inner) {
  const text = inner.trim()
  const commas = topLevel(text, ",")
  if (commas.length > 1) return { parts: commas.map((part) => part.trim()), alpha: null, legacy: true }
  const [main, alpha] = topLevel(text, "/")
  return { parts: main.trim().split(/\s+/).filter(Boolean), alpha: alpha === undefined ? null : alpha.trim(), legacy: false }
}

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`

/** A number, or a percentage mapped so 100% is `full`; `none` is 0. Anything else is null. */
function amount(word, full) {
  if (word === undefined) return null
  if (word === "none") return 0
  const percent = new RegExp(`^(${NUMBER})%$`, "i").exec(word)
  if (percent) return (Number(percent[1]) / 100) * full
  return new RegExp(`^${NUMBER}$`, "i").test(word) ? Number(word) : null
}

/** A hue in degrees: `162.85`, `162.85deg`, `0.5turn`. */
function angle(word) {
  if (word === undefined) return null
  if (word === "none") return 0
  const match = new RegExp(`^(${NUMBER})(deg|turn|rad|grad)?$`, "i").exec(word)
  if (!match) return null
  const value = Number(match[1])
  const unit = (match[2] ?? "deg").toLowerCase()
  if (unit === "turn") return value * 360
  if (unit === "rad") return (value * 180) / Math.PI
  return unit === "grad" ? value * 0.9 : value
}

function alphaOf(word) {
  if (word === null) return 1
  const value = amount(word, 1)
  return value === null ? null : clamp(value)
}

/** Parses one colour value, or returns null when it is not a colour this module reads. */
export function parseColor(text) {
  const value = String(text).trim().toLowerCase()
  if (value in NAMED) return fromSrgb(NAMED[value].slice(0, 3), NAMED[value][3])
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value)
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1]
    const channel = (index) => Number.parseInt(digits.slice(index * 2, index * 2 + 2), 16) / 255
    return fromSrgb([channel(0), channel(1), channel(2)], digits.length === 8 ? channel(3) : 1)
  }
  const call = /^([a-z-]+)\(([\s\S]*)\)$/.exec(value)
  if (!call) return null
  const [, name, inner] = call
  if (name === "color-mix") return parseMix(inner)
  if (!["rgb", "rgba", "hsl", "hsla", "oklab", "oklch"].includes(name)) return null
  const { parts, alpha: alphaWord, legacy } = splitArguments(inner)
  if (legacy && parts.length === 4) return build(name, parts.slice(0, 3), parts[3])
  return parts.length === 3 ? build(name, parts, alphaWord) : null
}

function build(name, [first, second, third], alphaWord) {
  const alpha = alphaOf(alphaWord)
  if (alpha === null) return null
  if (name === "rgb" || name === "rgba") {
    const rgb = [first, second, third].map((word) => amount(word, 255))
    return rgb.includes(null) ? null : fromSrgb(rgb.map((channel) => channel / 255), alpha)
  }
  if (name === "hsl" || name === "hsla") {
    const hue = angle(first)
    const saturation = amount(second, 100)
    const lightness = amount(third, 100)
    if ([hue, saturation, lightness].includes(null)) return null
    return fromSrgb(hslToSrgb(hue, clamp(saturation / 100), clamp(lightness / 100)), alpha)
  }
  if (name === "oklab") {
    const lab = [amount(first, 1), amount(second, 0.4), amount(third, 0.4)]
    return lab.includes(null) ? null : { lab, alpha, hue: null }
  }
  const lightness = amount(first, 1)
  const chroma = amount(second, 0.4)
  const hue = angle(third)
  if ([lightness, chroma, hue].includes(null)) return null
  return { lab: oklchToOklab([lightness, chroma, hue]), alpha, hue: ((hue % 360) + 360) % 360 }
}

function hslToSrgb(hueDegrees, saturation, lightness) {
  const hue = ((hueDegrees % 360) + 360) % 360
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const offset = lightness - chroma / 2
  const sectors = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]]
  return sectors[Math.floor(hue / 60)].map((channel) => channel + offset)
}

/** `color-mix(in <space> [<hue-method> hue], <colour> [<p>%], <colour> [<p>%])`. */
function parseMix(inner) {
  const [head, ...operands] = topLevel(inner, ",").map((part) => part.trim())
  const space = /^in\s+(oklab|oklch|srgb)(?:\s+(shorter|longer|increasing|decreasing)\s+hue)?$/.exec(head ?? "")
  if (!space || operands.length !== 2) return null
  const [, model, method = "shorter"] = space
  const items = operands.map((operand) => {
    const percentage = new RegExp(String.raw`(?:^|\s)(${NUMBER})%$`).exec(operand)
    const color = parseColor(percentage ? operand.slice(0, percentage.index).trim() : operand)
    return color === null ? null : { color, percent: percentage ? Number(percentage[1]) : null }
  })
  if (items.includes(null)) return null
  let [{ percent: p1 }, { percent: p2 }] = items
  if (p1 === null && p2 === null) [p1, p2] = [50, 50]
  else if (p1 === null) p1 = 100 - p2
  else if (p2 === null) p2 = 100 - p1
  const sum = p1 + p2
  if (!(sum > 0) || p1 < 0 || p2 < 0) return null
  const [w1, w2] = [p1 / sum, p2 / sum]
  const multiplier = sum < 100 ? sum / 100 : 1
  const [a, b] = [items[0].color, items[1].color]
  const mixedAlpha = a.alpha * w1 + b.alpha * w2
  const alpha = mixedAlpha * multiplier
  // Premultiplied interpolation: a transparent operand contributes no colour, only its share of the alpha.
  const mix = (first, second) => (mixedAlpha === 0 ? first * w1 + second * w2 : (a.alpha * first * w1 + b.alpha * second * w2) / mixedAlpha)
  if (model === "oklab") return { lab: [0, 1, 2].map((i) => mix(a.lab[i], b.lab[i])), alpha, hue: null }
  if (model === "srgb") {
    const [ra, rb] = [oklabToSrgb(a.lab), oklabToSrgb(b.lab)]
    return { lab: srgbToOklab([0, 1, 2].map((i) => mix(ra[i], rb[i]))), alpha, hue: null }
  }
  const [la, lb] = [oklabToOklch(a.lab), oklabToOklch(b.lab)]
  const hueOf = (color, lch) => (color.hue !== null ? color.hue : lch[1] < POWERLESS ? null : lch[2])
  const [ha, hb] = [hueOf(a, la), hueOf(b, lb)]
  let hue = 0
  if (ha === null) hue = hb ?? 0
  else hue = hb === null ? ha : mixHue(ha, hb, w1, w2, method)
  return { lab: oklchToOklab([mix(la[0], lb[0]), mix(la[1], lb[1]), hue]), alpha, hue }
}

function mixHue(a, b, w1, w2, method) {
  let [from, to] = [a, b]
  const delta = to - from
  if (method === "shorter" && delta > 180) from += 360
  else if (method === "shorter" && delta < -180) to += 360
  else if (method === "longer" && delta > 0 && delta < 180) from += 360
  else if (method === "longer" && delta > -180 && delta <= 0) to += 360
  else if (method === "increasing" && to < from) to += 360
  else if (method === "decreasing" && from < to) from += 360
  return (((from * w1 + to * w2) % 360) + 360) % 360
}

// -- contrast ----------------------------------------------------------------------------------------------------

/** Gamma sRGB clipped to the gamut. */
export const toSrgb = (color) => oklabToSrgb(color.lab).map((channel) => clamp(channel))

/** `color` over an opaque `background`, both from `parseColor`. */
export function composite(color, background) {
  if (color.alpha >= 1) return { ...color, alpha: 1 }
  const [top, under] = [toSrgb(color), toSrgb(background)]
  return fromSrgb(top.map((channel, i) => channel * color.alpha + under[i] * (1 - color.alpha)))
}

/** WCAG 2 relative luminance. */
export function luminance(color) {
  const [r, g, b] = toSrgb(color).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast of `foreground` on an opaque `background`; the foreground's alpha is composited on it first. */
export function contrast(foreground, background) {
  const [a, b] = [luminance(composite(foreground, background)), luminance(background)]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** True when two colours draw the same pixel (within half of an 8-bit channel) at the same alpha. */
export function sameColor(a, b) {
  if (Math.abs(a.alpha - b.alpha) > 1 / 512) return false
  const [x, y] = [toSrgb(a), toSrgb(b)]
  return x.every((channel, i) => Math.abs(channel - y[i]) < 0.5 / 255)
}
