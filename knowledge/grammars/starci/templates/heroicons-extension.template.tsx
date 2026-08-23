/** Durable StarCi template: stable product meanings receive paired cuts behind one icon vocabulary. */
type ProductIconProps = { readonly meaning: string; readonly role: "heading" | "leading" | "chip" }
declare const Outline24: (props: { readonly currentColor: true }) => JSX.Element
declare const Solid16: (props: { readonly currentColor: true }) => JSX.Element

export const HeroiconsExtensionTemplate = (props: ProductIconProps) => (
    props.role === "chip" ? <Solid16 currentColor /> : <Outline24 currentColor />
)

export const invariants = {
    brandMarksUseThisTemplate: false,
    ephemeralReactionsUseThisTemplate: false,
} as const
