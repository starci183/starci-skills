import { Heading } from "@starci/grammar/common"
import { BookingForm } from "@/components/blocks/BookingForm"
import { SignInForm } from "@/components/blocks/SignInForm"
import { SignOutButton } from "@/components/blocks/SignOutButton"

/** Props for the home page: its title. */
export type AppHomePageBaseProps = {
    readonly props: { readonly title: string }
}

/**
 * Draws the front door: the sign-in form for a signed-out reader, the reader, sign-out and the booking workspace once signed
 * in.
 */
export const AppHomePageBase = (props: AppHomePageBaseProps) => (
    <>
        <Heading level={1}>{props.props.title}</Heading>
        <SignInForm />
        <SignOutButton />
        <BookingForm />
    </>
)
