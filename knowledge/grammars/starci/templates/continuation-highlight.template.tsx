/** Durable StarCi template: one next/resume target owns the highlighted continuation surface. */
declare const ContinuationHighlightCard: (props: {
    readonly eyebrow: string
    readonly title: string
    readonly actionLabel: string
    readonly progress?: { readonly value: number; readonly label: string; readonly fact?: string }
    readonly onContinue: () => void
}) => JSX.Element

declare const SecondaryContinuationRun: (props: {
    readonly items: ReadonlyArray<{ readonly id: string; readonly title: string; readonly kind: string }>
}) => JSX.Element

export const ContinuationDecision = (props: {
    readonly primary: {
        readonly eyebrow: string
        readonly title: string
        readonly actionLabel: string
        readonly progress?: { readonly value: number; readonly label: string; readonly fact?: string }
        readonly onContinue: () => void
    }
    readonly secondary?: ReadonlyArray<{ readonly id: string; readonly title: string; readonly kind: string }>
}) => (
    <>
        <ContinuationHighlightCard {...props.primary} />
        {props.secondary?.length ? <SecondaryContinuationRun items={props.secondary} /> : null}
    </>
)

export const continuationHighlightContract = {
    primaryCount: 1,
    emphasisOwner: "ContinuationHighlightCard",
    actionOwner: "primary continuation target",
    secondaryEmphasis: "ordinary surface",
    progressOrder: "identity then progress then action",
} as const
