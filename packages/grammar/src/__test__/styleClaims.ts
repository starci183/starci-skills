/**
 * The claims-versus-CSS checker, shared by every object's shipped-geometry spec.
 *
 * This is the check `core/composition/Sidebar/styles.spec.ts` introduced in 0.4.3, lifted out of
 * that one object so 0.4.4 could apply it to the rest of the package. A `data-contract` id is a
 * PROMISE about the paint; while an object spelled its geometry in Tailwind utilities the promise
 * was only true where a consumer's build happened to scan `node_modules/@starci/grammar`. Now that
 * the geometry ships, every id an element emits must be backed by a declaration on a Grammar class
 * that element actually carries.
 *
 * It lives under `src/__test__/` and is excluded from `tsconfig.build.json`, so nothing here
 * reaches `dist` or the package boundary.
 */

export type Declaration = { readonly property: string; readonly value: string }

type Rule = { readonly selector: string; readonly body: string }

/**
 * Flatten the sheet to leaf rules.
 *
 * Walking rather than regex-matching, because the sheet nests: `@layer`, `@media`, `@container` and
 * `@supports` all wrap real rules, and `@keyframes` / `@property` wrap blocks that are not rules at
 * all. Only a block whose body contains no further block is a rule.
 */
export const cssRules = (css: string): ReadonlyArray<Rule> => {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, "")
    const rules: Array<Rule> = []
    const stack: Array<{ prelude: string; start: number }> = []
    let cursor = 0
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        if (character === "{") {
            stack.push({ prelude: source.slice(cursor, index).trim(), start: index + 1 })
            cursor = index + 1
            continue
        }
        if (character !== "}") continue
        const open = stack.pop()
        if (open === undefined) continue
        const body = source.slice(open.start, index)
        if (!body.includes("{") && !open.prelude.startsWith("@")) rules.push({ selector: open.prelude, body })
        cursor = index + 1
    }
    return rules
}

/** Only the SUBJECT of a selector owns its declarations; an ancestor state selector does not. */
const subjects = (selector: string): ReadonlyArray<string> =>
    selector.split(",").map((part) => part.trim().split(/\s+/).at(-1) ?? "")

/**
 * Every declaration the sheet writes for one Grammar class, across all of its state selectors.
 *
 * The union across states is deliberate: a claim says the class is painted, not that it is painted
 * in one particular state, and a state-keyed rule is still that class's own rule.
 */
export const declarationsFor = (css: string, className: string): ReadonlyArray<Declaration> => {
    const owns = new RegExp(`\\.${className}(?![\\w-])`)
    return cssRules(css)
        .filter((rule) => subjects(rule.selector).some((subject) => owns.test(subject)))
        .flatMap((rule) => rule.body.split(";"))
        .map((declaration) => declaration.split(":"))
        .filter((parts) => parts.length >= 2)
        .map((parts) => ({
            property: (parts[0] ?? "").trim(),
            value: parts.slice(1).join(":").replace("!important", "").trim(),
        }))
}

/**
 * The spacing ramp the `PADDING-n` / `GAP-n` rule ids index.
 *
 * These ids are ROWS in padding.md / gap.md's `## Scale`, not quarter-rem steps: the package's own
 * `PrimaryRailLayout` claims `GAP-5` for the 1.5rem region gap, and `Rail` claims `PADDING-5` for
 * its 1.5rem block inset, both of which only read as the sixth row of this ramp. The ramp agrees
 * with `COMMON_SPACING_SCALE` on every id from 0 to 4.
 */
const SPACING_RAMP = ["0", "0.25rem", "0.5rem", "0.75rem", "1rem", "1.5rem", "2rem"] as const

/**
 * Lengths inside a declaration value, including the fallback of a `var()`.
 *
 * A shipped rule writes `gap: var(--starci-core-row-gap, 0.75rem)`, so the value has to be read for
 * the length it resolves to when the token is absent, which is exactly what a consumer without the
 * token gets.
 */
const lengths = (value: string): ReadonlyArray<string> =>
    (value.match(/\d*\.?\d+(?:rem|px|em)|(?<![\w.-])0(?![\w.])/g) ?? []).map((length) => length.trim())

const hasLength = (declarations: ReadonlyArray<Declaration>, propertyPrefix: string, length: string) =>
    declarations.some((declaration) => declaration.property.startsWith(propertyPrefix) && lengths(declaration.value).includes(length))

const hasProperty = (declarations: ReadonlyArray<Declaration>, ...propertyPrefixes: ReadonlyArray<string>) =>
    declarations.some((declaration) => propertyPrefixes.some((prefix) => declaration.property.startsWith(prefix)))

/** Whether the sheet keeps one `data-contract` promise on the class that carries it. */
export const backsClaim = (claim: string, declarations: ReadonlyArray<Declaration>): boolean => {
    const [family = "", step = ""] = claim.split(/-(?=\d+$|AUTO$)/)
    const spacing = SPACING_RAMP[Number(step)]
    switch (family) {
    case "PADDING": return spacing !== undefined && hasLength(declarations, "padding", spacing)
    case "GAP": return spacing !== undefined && (hasLength(declarations, "gap", spacing) || hasLength(declarations, "row-gap", spacing) || hasLength(declarations, "column-gap", spacing))
    case "MARGIN": return hasProperty(declarations, "margin")
    case "FONT": return hasProperty(declarations, "font-size", "font-weight")
    case "TONE": return hasProperty(declarations, "color")
    case "SURFACE": return hasProperty(declarations, "background")
    // A boundary is drawn either as a rule of its own or as a border on the thing it separates.
    case "BOUNDARY": return hasProperty(declarations, "border", "background", "box-shadow")
    // "Fills its shell" is expressed as a width OR as the flex that takes the remaining track.
    case "MEASURE": return hasProperty(declarations, "width", "inline-size", "max-width", "min-width", "flex")
    case "OVERFLOW": return hasProperty(declarations, "overflow")
    case "FLOW": return hasProperty(declarations, "text-overflow", "min-width", "overflow-wrap")
    default: return false
    }
}

/** Every Grammar class an element carries; a claim may be backed by any one of them. */
export const grammarClassNames = (element: Element): ReadonlyArray<string> =>
    [...element.classList].filter((token) => token.startsWith("starci-core-"))

/** Report the ids one claimed element emits that the sheet does not keep. */
export const unbackedClaims = (css: string, element: Element): ReadonlyArray<string> => {
    const declarations = grammarClassNames(element).flatMap((className) => declarationsFor(css, className))
    return (element.getAttribute("data-contract") ?? "")
        .split(" ")
        .filter(Boolean)
        .filter((claim) => !backsClaim(claim, declarations))
}
