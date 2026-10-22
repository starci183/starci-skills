import { Badge, type BadgeTone } from "@starci/grammar/common"

/** Props for StatusChip: an already-translated label and its tone. */
type StatusChipProps = {
    readonly label: string
    readonly tone: BadgeTone
}

/** Leaf: one pill-shaped status label. */
export const StatusChip = (props: StatusChipProps) => (
    <Badge tone={props.tone}>
        {props.label}
    </Badge>
)
