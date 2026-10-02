import { Button, Heading, Text } from "@starci/grammar/common"

/** Props for {@link LandingPageBase}. */
export type LandingPageBaseProps = {
    /** The words and the link the page shows, already resolved. */
    readonly props: {
        readonly title: string
        readonly lede: string
        readonly openApp: string
        /** The product app's origin: the landing hands the reader over to it. */
        readonly appHref: string
    }
}

/** Draw the public front door: the welcome, one sentence about the product and the way into the product app. */
export const LandingPageBase = (props: LandingPageBaseProps) => (
    <>
        <Heading level={1}>{props.props.title}</Heading>
        <Text tone="muted">{props.props.lede}</Text>
        <Button href={props.props.appHref} variant="primary">
            {props.props.openApp}
        </Button>
    </>
)
