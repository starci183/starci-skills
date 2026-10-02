import { HandoffBlock } from "@/components/blocks/HandoffBlock"
import { SendHistoryBlock } from "@/components/blocks/SendHistoryBlock"
import { operatePageEditGridClassName } from "./classNames"

/** Shape of the page: "edit" adds the history column, so it is its own drawing. */
export type OperatePageState = "view" | "edit"

/** Atoms only. The page has no slot: every api belongs to a block. */
export type OperatePageData = { readonly handoffId: string }

/** Complete input of OperatePageBase. */
export type OperatePageBaseProps = {
    readonly state: OperatePageState
    readonly props: OperatePageData
}

/** Pure half: composes blocks with atoms; never fetches, never renders a data status. */
export const OperatePageBase = (props: OperatePageBaseProps) =>
    props.state === "edit" ? (
        <div className={operatePageEditGridClassName}>
            <HandoffBlock handoffId={props.props.handoffId} />
            <SendHistoryBlock handoffId={props.props.handoffId} />
        </div>
    ) : (
        <HandoffBlock handoffId={props.props.handoffId} />
    )
