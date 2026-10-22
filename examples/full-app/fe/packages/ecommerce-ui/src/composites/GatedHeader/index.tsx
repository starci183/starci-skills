import { SectionHeader } from "@starci/grammar/common"
import { GateNotice, type GateNoticeProps } from "../GateNotice"

/** A page's heading and, when the reader is gated out, the gate that explains why and lifts it. */
type GatedHeaderProps = {
    readonly title: string
    readonly description: string
    /** The gate to show beneath the heading, or `null` when the reader is let through. */
    readonly gate: GateNoticeProps | null
}

/** The heading of a page whose content can be gated behind a sign-in. */
export const GatedHeader = (props: GatedHeaderProps) => (
    <>
        <SectionHeader title={props.title} description={props.description} level={1} />
        {props.gate === null ? null : (
            <GateNotice
                title={props.gate.title}
                description={props.gate.description}
                actionLabel={props.gate.actionLabel}
                actionHref={props.gate.actionHref}
            />
        )}
    </>
)
