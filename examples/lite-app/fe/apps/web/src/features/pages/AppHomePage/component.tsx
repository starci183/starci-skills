import { Heading, Text } from "@starci/grammar/common"

/** Props for the signed-in home page. */
export type AppHomePageBaseProps = {
    readonly props: {
        readonly title: string
        readonly principal: string
        readonly resources: string
        readonly bookings: string
    }
}

/** Draws the signed-in front door. */
export const AppHomePageBase = (props: AppHomePageBaseProps) => (
    <>
        <Heading level={1}>{props.props.title}</Heading>
        <Text>{props.props.principal}</Text>
        <Text>{props.props.resources}</Text>
        <Text>{props.props.bookings}</Text>
    </>
)
