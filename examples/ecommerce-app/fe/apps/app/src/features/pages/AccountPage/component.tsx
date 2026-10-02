import { Heading, SectionHeader, Text } from "@starci/grammar/common"
import { DuckMascot, StateBlock, SlotView, type Slot } from "@ecommerce/ui"
import { SessionForm } from "../../../components/blocks/SessionForm"
import { SignOutAction } from "../../../components/blocks/SignOutAction"
import { accountPageClassNames } from "./classNames"

/**
 * The screen situations the account read can settle. `signedOut` is the gate - no live session
 * answered, so the surface is the sign-in split itself; `unreachable` is the identity service
 * refusing to say who this is; `empty` and `buyer` are the signed-in surfaces the `hasOrders`
 * answer splits - a confirmed buyer vs a confirmed non-buyer.
 */
export type AccountPageState = "signedOut" | "account"

/** The account page's resolved inputs: every string settled, and the mounted session blocks. */
export type AccountPageProps = {
    /** Whole-screen situations this surface settles. */
    readonly state: AccountPageState
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly title: string
        /** The signed-in or service-unreachable line; the anonymous surface carries its own heading. */
        readonly accountLine: string
        /** The split's left-panel headline - the auth illustration's welcome line. */
        readonly authHeadline: string
        readonly authLede: string
        readonly ordersTitle: string
        readonly ordersSignedOutTitle: string
        readonly ordersSignedOutDescription: string
        readonly ordersUnreachableTitle: string
        readonly ordersUnreachableDescription: string
        readonly ordersEmptyTitle: string
        readonly ordersEmptyDescription: string
        readonly ordersBuyerTitle: string
        readonly ordersBuyerDescription: string
        readonly ordersSlot: Slot<true>
    }
}

/**
 * The account route's whole render. A signed-out visitor gets the `ui.identity.sign-in` split -
 * the welcome panel with the one auth duck on the left, the connected session form on the right -
 * because a signed-out viewer has no account to read; the orders region still answers for itself
 * beneath it. A signed-in viewer gets who they are, the sign-out action, and the honest orders
 * answer: the backend serves no per-order list, so `buyer` says the service confirms orders and
 * `empty` says it confirms none (the duck's genuine empty state). An unreachable identity service
 * is an error surface - no mascot - and the orders region reports the same refusal.
 */
export const AccountPageBase = (props: AccountPageProps) => (
    <>
        <SectionHeader
            title={props.props.title}
            description={props.props.accountLine}
            level={1}
            action={
                props.state === "account" && props.props.ordersSlot.status !== "error" ? <SignOutAction /> : undefined
            }
        />
        {props.state === "signedOut" ? (
            <div className={accountPageClassNames.authSplit}>
                <div className={accountPageClassNames.authIntro}>
                    <Heading level={2} scale="display">
                        {props.props.authHeadline}
                    </Heading>
                    <Text size="md" tone="muted">
                        {props.props.authLede}
                    </Text>
                    <DuckMascot size={128} aria-hidden />
                </div>
                <div className={accountPageClassNames.authForm}>
                    <SessionForm />
                </div>
            </div>
        ) : null}
        <div className={accountPageClassNames.orders}>
            <SectionHeader title={props.props.ordersTitle} level={2} />
            {props.state === "signedOut" ? (
                <StateBlock
                    title={props.props.ordersSignedOutTitle}
                    description={props.props.ordersSignedOutDescription}
                />
            ) : null}
            {props.state === "account" ? (
                <SlotView
                    slot={props.props.ordersSlot}
                    emptyMascot
                    labels={{
                        emptyTitle: props.props.ordersEmptyTitle,
                        emptyDescription: props.props.ordersEmptyDescription,
                        errorTitle: props.props.ordersUnreachableTitle,
                        errorDescription: props.props.ordersUnreachableDescription,
                    }}
                >
                    {() => (
                        <StateBlock
                            title={props.props.ordersBuyerTitle}
                            description={props.props.ordersBuyerDescription}
                        />
                    )}
                </SlotView>
            ) : null}
        </div>
    </>
)
