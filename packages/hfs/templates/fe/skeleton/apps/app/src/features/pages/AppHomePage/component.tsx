import { Heading } from "@starci/grammar/common"

/** Props for {@link AppHomePageBase}. */
export type AppHomePageBaseProps = {
    /** The words the page shows. */
    readonly props: { readonly title: string }
}

/** Draw the front door of the product app. */
export const AppHomePageBase = (props: AppHomePageBaseProps) => <Heading level={1}>{props.props.title}</Heading>
