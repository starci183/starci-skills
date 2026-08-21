/** Durable StarCi template: independent bounded tab axes stack narrowly and share one row widely. */
type TabChoice = {
    readonly id: string
    readonly label: string
    readonly disabled?: boolean
}

type TabAxis = {
    readonly id: string
    readonly label: string
    readonly selectedKey: string
    readonly choices: ReadonlyArray<TabChoice>
    readonly onSelect: (key: string) => void
}

type ResponsiveTabToolbarProps = {
    readonly axes: ReadonlyArray<TabAxis>
}

declare const TabList: (props: {
    readonly label: string
    readonly selectedKey: string
    readonly choices: ReadonlyArray<TabChoice>
    readonly onSelect: (key: string) => void
    readonly labelWrapping: "forbidden"
}) => JSX.Element

export const ResponsiveTabToolbarTemplate = (props: ResponsiveTabToolbarProps) => {
    // An axis with zero or one available value cannot change the result, so it is not a control.
    const variableAxes = props.axes.filter((axis) => axis.choices.filter((choice) => choice.disabled !== true).length > 1)

    if (variableAxes.length === 0) return null

    return (
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {variableAxes.map((axis) => (
                // Each axis preserves its own selection and may scroll horizontally without wrapping labels.
                <div key={axis.id} className="min-w-0 overflow-x-auto overscroll-x-contain">
                    <TabList
                        label={axis.label}
                        selectedKey={axis.selectedKey}
                        choices={axis.choices}
                        onSelect={axis.onSelect}
                        labelWrapping="forbidden"
                    />
                </div>
            ))}
        </div>
    )
}

export const invariants = {
    selectionOwnerPerAxis: 1,
    narrowPresentation: "stacked-axes",
    widePresentation: "shared-row",
    labelWrapping: false,
    narrowOverflowOwner: "each-axis",
    inertAxesRendered: false,
    axesMerged: false,
} as const
