import { Button, Footer, GrammarRoot, Heading, PageContainer, Text, WorkspaceShell } from "@starci/grammar/common"
import { ROUTES } from "@/modules/routes"
import {
    UNSUBSCRIBE_ACTION_ROW_CLASS_NAME,
    UNSUBSCRIBE_COLUMN_CLASS_NAME,
    UNSUBSCRIBE_HEADING_GROUP_CLASS_NAME,
} from "./classNames"

/** The closed state vocabulary of the signed-out unsubscribe surface. */
export const NOTIFY_UNSUBSCRIBE_STATES = ["idle", "pending", "unsubscribed", "refused"] as const

/** One member of the unsubscribe surface's state vocabulary. */
export type NotifyUnsubscribeState = (typeof NOTIFY_UNSUBSCRIBE_STATES)[number]

/** Every word the pure unsubscribe screen renders, resolved by the connected half. */
export type NotifyUnsubscribeViewCopy = {
    readonly brand: string
    readonly legalLabel: string
    readonly legal: {
        readonly privacyPolicy: string
        readonly terms: string
    }
    /** The main landmark's accessible name. */
    readonly mainLabel: string
    readonly heading: string
    readonly tagline: string
    readonly tokenMissing: string
    readonly done: string
    readonly refused: string
    readonly action: string
    readonly pending: string
}

/** The view's complete contract: the lifecycle state, whether the link carried its token, every
 * word to draw, and the one action. */
export interface NotifyUnsubscribeViewProps {
    readonly state: NotifyUnsubscribeState
    /** The link's `token` parameter was absent or empty, so the control cannot run. */
    readonly tokenMissing: boolean
    readonly copy: NotifyUnsubscribeViewCopy
    readonly onUnsubscribe: () => void
}

/**
 * The pure render of the derived unsubscribe-link screen: a signed-out projection of
 * ui.notify.preferences' coverage map, so it keeps the product name and policy footer but drops
 * the authenticated shell, navigation and Alex. No hooks, no transport, no world state.
 */
export const NotifyUnsubscribeView = (props: NotifyUnsubscribeViewProps) => {
    const copy = props.copy
    const { state, tokenMissing } = props

    return (
        <GrammarRoot data-state={state}>
            <WorkspaceShell
                primaryLabel={copy.mainLabel}
                primary={
                    <PageContainer measure="product">
                        <div className={UNSUBSCRIBE_COLUMN_CLASS_NAME}>
                            <Text as="span" weight="semibold">
                                {copy.brand}
                            </Text>
                            <div className={UNSUBSCRIBE_HEADING_GROUP_CLASS_NAME}>
                                <Heading level={1}>{copy.heading}</Heading>
                                <Text tone="muted">{copy.tagline}</Text>
                            </div>
                            {tokenMissing ? <Text live="polite">{copy.tokenMissing}</Text> : null}
                            {state === "unsubscribed" ? <Text live="polite">{copy.done}</Text> : null}
                            {state === "refused" ? <Text live="polite">{copy.refused}</Text> : null}
                            <div className={UNSUBSCRIBE_ACTION_ROW_CLASS_NAME}>
                                <Button
                                    variant="secondary"
                                    isDisabled={tokenMissing || state === "pending" || state === "unsubscribed"}
                                    isPending={state === "pending"}
                                    onPress={props.onUnsubscribe}
                                >
                                    {state === "pending" ? copy.pending : copy.action}
                                </Button>
                            </div>
                            <Footer
                                label={copy.legalLabel}
                                groups={[
                                    {
                                        id: "legal",
                                        label: copy.legalLabel,
                                        links: [
                                            {
                                                id: "privacyPolicy",
                                                label: copy.legal.privacyPolicy,
                                                href: ROUTES.privacyPolicy,
                                            },
                                            { id: "terms", label: copy.legal.terms, href: ROUTES.terms },
                                        ],
                                    },
                                ]}
                            />
                        </div>
                    </PageContainer>
                }
            />
        </GrammarRoot>
    )
}
