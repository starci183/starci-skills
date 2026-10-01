import { SignInPageBase } from "./component"

/**
 * The sign-in route's connected half. The screen is a public surface - it renders whether or not
 * a token exists - so the page's whole situation space is "ready".
 */
export const SignInPage = () => {
    return <SignInPageBase />
}
