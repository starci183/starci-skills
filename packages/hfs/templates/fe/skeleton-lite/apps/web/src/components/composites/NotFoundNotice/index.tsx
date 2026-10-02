import { Heading, TextAction } from "@starci/grammar/common"

/** The words of a missing page and the way home. */
type NotFoundNoticeProps = {
    readonly title: string
    readonly homeLabel: string
    readonly homeHref: string
}

/** A missing page with one destination back to the app's front door. */
export const NotFoundNotice = (props: NotFoundNoticeProps) => (
    <>
        <Heading level={1}>{props.title}</Heading>
        <TextAction appearance="inline" href={props.homeHref}>
            {props.homeLabel}
        </TextAction>
    </>
)
