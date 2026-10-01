import { Button } from "@starci/grammar/common"
import { StateBlock } from "../../leaves/StateBlock"

/** The words of a gated surface and the one way past the gate. */
export type GateNoticeProps = {
    readonly title: string
    readonly description: string
    readonly actionLabel: string
    readonly actionHref: string
}

/** A gated route's answer: why nothing is shown, and the destination that lifts the gate. */
export const GateNotice = (props: GateNoticeProps) => (
    <StateBlock title={props.title} description={props.description}>
        <Button href={props.actionHref} variant="secondary" size="sm">
            {props.actionLabel}
        </Button>
    </StateBlock>
)
