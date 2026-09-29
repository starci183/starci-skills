/**
 * `starci/breakpoint-scale` (HFS R61 `FE_STYLE_TOKEN_ONLY`): a width breakpoint in `@media` comes from the grammar's
 * scale (`lib/vocabulary.generated.mjs` `BREAKPOINTS`, read from the grammar's own media queries).
 *
 * A breakpoint of 700px next to the grammar's 48rem makes two layouts that change at different widths on one page.
 * A length is accepted in `rem`/`em` when it is on the scale, or in `px` when it equals a scale entry at 16px to the
 * rem (`768px` is `48rem`). This is the one place a `px` may be written outside `brand.css`. Features that are not
 * widths (`prefers-color-scheme`, `pointer`, `forced-colors`) are not judged.
 */
import { makeRule } from "./lib/make-rule.mjs"
import { BREAKPOINTS } from "./lib/vocabulary.generated.mjs"

const SCALE = BREAKPOINTS.map((value) => Number.parseFloat(value))

/** Every width length in a media query: `min-width: 40rem`, `width >= 40rem`, `40rem <= width`. */
const WIDTH_LENGTHS = [
  /(?:min-|max-)?(?:device-)?width\s*:\s*(-?[\d.]+)(px|rem|em)/g,
  /(?<![\w-])(?:device-)?width\s*(?:<=|>=|<|>|=)\s*(-?[\d.]+)(px|rem|em)/g,
  /(-?[\d.]+)(px|rem|em)\s*(?:<=|>=|<|>)\s*(?:device-)?width(?![\w-])/g,
]

const onScale = (value, unit) => {
  const rem = unit === "px" ? value / 16 : value
  return SCALE.some((entry) => Math.abs(entry - rem) < 0.0005)
}

export const breakpointScale = makeRule(
  "breakpoint-scale",
  {
    off: (length) =>
      `The breakpoint \`${length}\` is not on the grammar's scale (${BREAKPOINTS.join(", ")}). Use a scale width so layouts change together.`,
  },
  ({ root, report }) => {
    root.walkAtRules("media", (rule) => {
      for (const pattern of WIDTH_LENGTHS) {
        for (const match of rule.params.matchAll(pattern)) {
          const value = Number.parseFloat(match[1])
          if (!onScale(value, match[2])) report(rule, "off", [`${match[1]}${match[2]}`], { word: `${match[1]}${match[2]}` })
        }
      }
    })
  },
)
