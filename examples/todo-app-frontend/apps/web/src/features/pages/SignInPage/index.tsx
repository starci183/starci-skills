import { SignInPageBase } from "./component"

/** The public props of the sign-in route: the route hands it nothing. */
export type SignInPageProps = Record<never, never>

/**
 * The sign-in route's connected half. The screen is a public surface - it renders whether or not
 * a token exists - so the page's whole situation space is "ready".
 */
export const SignInPage = (props: SignInPageProps) => {
    void props
    return <SignInPageBase state="ready" props={{}} on={{}} />
}
