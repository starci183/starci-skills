import assert from "node:assert/strict"
import test from "node:test"
import { composite, contrast, oklabToOklch, parseColor, sameColor, toSrgb } from "./lib/color.mjs"

const near = (actual, expected, tolerance = 0.002) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`)
const rgb = (text) => toSrgb(parseColor(text)).map((channel) => Math.round(channel * 255))
const within = (actual, expected) => actual.forEach((channel, i) => assert.ok(Math.abs(channel - expected[i]) <= 1, `${actual} is not ${expected}`))

test("hex, rgb() and hsl() read to the same sRGB", () => {
  assert.deepEqual(rgb("#ff8000"), [255, 128, 0])
  assert.deepEqual(rgb("#f80"), [255, 136, 0])
  assert.deepEqual(rgb("rgb(255 128 0)"), [255, 128, 0])
  within(rgb("rgb(100%, 50%, 0%)"), [255, 128, 0])
  within(rgb("hsl(30 100% 50%)"), [255, 128, 0])
  within(rgb("hsl(120deg 100% 25%)"), [0, 128, 0])
  assert.equal(parseColor("#ff000080").alpha.toFixed(2), "0.50")
  assert.equal(parseColor("rgb(0 0 0 / 25%)").alpha, 0.25)
  assert.equal(parseColor("rgba(0, 0, 0, 0.4)").alpha, 0.4)
})

test("oklch() and oklab() match the known conversions of sRGB red and white", () => {
  const [L, C, H] = oklabToOklch(parseColor("#ff0000").lab)
  near(L, 0.62796, 0.0005)
  near(C, 0.25768, 0.0005)
  near(H, 29.234, 0.01)
  assert.deepEqual(rgb("oklch(62.7955% 0.257683 29.2339)"), [255, 0, 0])
  assert.deepEqual(rgb("oklch(100% 0 0)"), [255, 255, 255])
  assert.deepEqual(rgb("oklab(100% 0 0)"), [255, 255, 255])
  assert.deepEqual(rgb("oklch(0% 0 0)"), [0, 0, 0])
  assert.deepEqual(rgb("oklch(0.5 0.1 0.5turn)"), rgb("oklch(50% 0.1 180deg)"))
})

test("color-mix in oklab is a straight mix of OKLab, with premultiplied alpha", () => {
  assert.deepEqual(rgb("color-mix(in oklab, white 100%, black)"), [255, 255, 255])
  const grey = rgb("color-mix(in oklab, white, black)")
  assert.deepEqual(grey, [99, 99, 99])
  assert.equal(parseColor("color-mix(in oklab, #f00 15%, transparent)").alpha, 0.15)
  assert.deepEqual(rgb("color-mix(in oklab, #ff0000 15%, transparent)"), [255, 0, 0])
  assert.equal(parseColor("color-mix(in oklab, #f00 20%, #00f 20%)").alpha, 0.4)
  assert.deepEqual(rgb("color-mix(in oklab, #ff0000 80%, #0000ff 60%)"), rgb("color-mix(in oklab, #ff0000 57.142857%, #0000ff 42.857143%)"))
})

test("color-mix in srgb and oklch", () => {
  within(rgb("color-mix(in srgb, #ff0000 50%, #0000ff)"), [128, 0, 128])
  const between = oklabToOklch(parseColor("color-mix(in oklch, oklch(60% 0.2 350) 50%, oklch(60% 0.2 10))").lab)
  near(between[2], 0, 0.5)
  near(between[1], 0.2, 0.001)
  const longer = oklabToOklch(parseColor("color-mix(in oklch longer hue, oklch(60% 0.2 350) 50%, oklch(60% 0.2 10))").lab)
  near(longer[2], 180, 0.5)
})

test("a value that is not a colour this module reads is null, never a guess", () => {
  for (const text of ["currentcolor", "oklch(from red l c h)", "light-dark(#fff, #000)", "color-mix(in lab, red, blue)", "rgb(1 2)", "var(--x)", "oklch(50% 0.1 nope)", "12px", ""]) {
    assert.equal(parseColor(text), null, text)
  }
})

test("WCAG 2 contrast: the extremes, a mid grey and the darkened solid success of nivo-fe", () => {
  assert.equal(contrast(parseColor("#000"), parseColor("#fff")).toFixed(2), "21.00")
  assert.equal(contrast(parseColor("#fff"), parseColor("#fff")).toFixed(2), "1.00")
  assert.equal(contrast(parseColor("#777"), parseColor("#fff")).toFixed(2), "4.48")
  assert.equal(contrast(parseColor("oklch(58% 0.16 162.85)"), parseColor("oklch(100% 0 0)")).toFixed(2), "3.81")
})

test("alpha is composited on the background before the ratio is read", () => {
  const half = parseColor("rgb(0 0 0 / 50%)")
  within(toSrgb(composite(half, parseColor("#fff"))).map((channel) => Math.round(channel * 255)), [128, 128, 128])
  near(contrast(half, parseColor("#fff")), contrast(parseColor("#808080"), parseColor("#fff")), 0.05)
})

test("sameColor compares what is drawn, not how it is written", () => {
  assert.ok(sameColor(parseColor("#ff0000"), parseColor("oklch(62.7955% 0.257683 29.2339)")))
  assert.ok(!sameColor(parseColor("#ff0000"), parseColor("#fe0000")))
  assert.ok(!sameColor(parseColor("#ff0000"), parseColor("#ff000080")))
})
