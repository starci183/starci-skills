import { HandoffBlock } from "@/components/blocks/HandoffBlock"
import { SendHistoryBlock } from "@/components/blocks/SendHistoryBlock"
import { SendHandoffBlock } from "@/components/blocks/SendHandoffBlock"
import type { SendInput } from "@/modules/types"
import { operatePageEditGridClassName } from "./classNames"

/** Shape of the page: "edit" adds the history column, so it is its own drawing. */
export type OperatePageState = "view" | "edit"

/** Atoms only. The page has no slot: every api belongs to a block. */
export type OperatePageData = {
    readonly handoffId: string
    readonly sendInput?: SendInput
}

/** Actions the pure half emits. */
export type OperatePageActions = {
    readonly openSend: (input: SendInput) => void
    readonly closeSend: () => void
}

/** Complete input of OperatePageBase. */
export type OperatePageBaseProps = {
    readonly state: OperatePageState
    readonly props: OperatePageData
    readonly on: OperatePageActions
}

/** Pure half: composes blocks with atoms; never fetches, never renders a data status. */
export const OperatePageBase = (props: OperatePageBaseProps) => (
    <>
        {props.state === "edit" ? (
            <div className={operatePageEditGridClassName}>
                <HandoffBlock handoffId={props.props.handoffId} onRequestSend={props.on.openSend} />
                <SendHistoryBlock handoffId={props.props.handoffId} />
            </div>
        ) : (
            <HandoffBlock handoffId={props.props.handoffId} onRequestSend={props.on.openSend} />
        )}
        <SendHandoffBlock handoffId={props.props.handoffId} input={props.props.sendInput} onClose={props.on.closeSend} />
    </>
)
