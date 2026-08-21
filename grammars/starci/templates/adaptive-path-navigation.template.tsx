/** Durable StarCi template: shallow paths show breadcrumbs; paths of depth three or more show one back link. */
type PathStep = {
    readonly id: string
    readonly label: string
    readonly onPress?: () => void
}

type AdaptivePathNavigationProps = {
    readonly label: string
    readonly backLabel: string
    readonly steps: ReadonlyArray<PathStep>
    readonly isLoading?: boolean
}

declare const BreadcrumbTrail: (props: {
    readonly label: string
    readonly steps: ReadonlyArray<PathStep>
    readonly currentStepId?: string
}) => JSX.Element
declare const BackLink: (props: { readonly label: string; readonly onPress: () => void }) => JSX.Element
declare const PathNavigationSkeleton: (props: { readonly presentation: "back-link" | "breadcrumbs" }) => JSX.Element

/** The parent is the deepest pressable ancestor, never the current step. */
const deepestPressableAncestor = (steps: ReadonlyArray<PathStep>) =>
    [...steps.slice(0, -1)].reverse().find((step) => step.onPress !== undefined)

export const AdaptivePathNavigationTemplate = (props: AdaptivePathNavigationProps) => {
    const parent = deepestPressableAncestor(props.steps)
    const presentation = props.steps.length >= 3 && parent !== undefined ? "back-link" : "breadcrumbs"

    if (props.isLoading === true) {
        return <PathNavigationSkeleton presentation={presentation} />
    }

    if (presentation === "back-link" && parent?.onPress !== undefined) {
        return <BackLink label={props.backLabel} onPress={parent.onPress} />
    }

    return (
        <BreadcrumbTrail
            label={props.label}
            steps={props.steps}
            currentStepId={props.steps.at(-1)?.id}
        />
    )
}

export const invariants = {
    backLinkThreshold: 3,
    backTarget: "deepest-pressable-ancestor",
    currentStepIsPressable: false,
    loadingShapeMatchesResolvedPresentation: true,
} as const
