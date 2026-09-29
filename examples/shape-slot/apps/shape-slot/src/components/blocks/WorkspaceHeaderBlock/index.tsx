import { Heading } from "@starci/grammar/common"

/** Input of WorkspaceHeaderBlock. */
export type WorkspaceHeaderBlockProps = { readonly workspaceId: string }

/** Pure block with one shape and no api: no connected twin is needed. */
export const WorkspaceHeaderBlock = (props: WorkspaceHeaderBlockProps) => <Heading level={1}>{props.workspaceId}</Heading>
