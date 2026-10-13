import { Heading } from "@starci/grammar/common"
import { SignInForm } from "@/components/blocks/SignInForm"
import { SignOutButton } from "@/components/blocks/SignOutButton"

/** Props for {@link AppHomePageBase}. */
export type AppHomePageBaseProps = {
    /** The words the page shows. */
    readonly props: { readonly title: string }
}

/** Draw the front door of the product app: the sign-in form for a signed-out reader, the reader and sign-out once signed in. */
export const AppHomePageBase = (props: AppHomePageBaseProps) => (
    <>
        <Heading level={1}>{props.props.title}</Heading>
        <SignInForm />
        <SignOutButton />
    </>
)
