import { OperatePageBase } from "./component"

/** Input of OperatePage: route params as atoms, plus whether the viewer may edit. */
type OperatePageProps = {
    readonly handoffId: string
    readonly canEdit: boolean
}

/**
 * The operate page owner: a server component, like every page. It only picks the page's shape;
 * the send overlay's open state is the HandoffBlock's own, so nothing interactive lives here.
 */
export const OperatePage = (props: OperatePageProps) => (
    <OperatePageBase state={props.canEdit ? "edit" : "view"} props={{ handoffId: props.handoffId }} />
)
