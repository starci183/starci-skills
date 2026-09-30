import { Heading, TextAction } from "@starci/grammar/common"

/** The words of a page that does not exist and the way back. */
type NotFoundNoticeProps = {
    readonly title: string
    readonly homeLabel: string
}

/** A missing page: the message and the way back to the product's front door. */
export const NotFoundNotice = (props: NotFoundNoticeProps) => (
    <>
        <Heading level={1}>{props.title}</Heading>
        <TextAction appearance="inline" href="/">
            {props.homeLabel}
        </TextAction>
    </>
)
