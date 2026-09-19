import { SignInScreenBlock } from "@/components/login/sign-in"

/** Props for {@link SignInPageBase}. */
export type SignInPageProps = {
    /** Whole-screen situations this surface settles; the screen owns its own submission state. */
    readonly state: "ready"
    /** The data payload for whatever state is showing; the screen wants nothing from the route. */
    readonly props: Record<never, never>
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the sign-in screen; the block owns the form, the split layout, and the session write. */
export const SignInPageBase = (props: SignInPageProps) => {
    void props
    return <SignInScreenBlock {...{}} />
}
