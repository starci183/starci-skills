import { Heading } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** Props for the home page: its title and the session surface the entry composes. */
export type AppHomePageBaseProps = {
    readonly props: { readonly title: string }
    readonly session: ReactNode
}

/** Draws the front door. */
export const AppHomePageBase = (props: AppHomePageBaseProps) => (
    <>
        <Heading level={1}>{props.props.title}</Heading>
        {props.session}
    </>
)
