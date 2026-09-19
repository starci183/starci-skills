import { Button, GrammarRoot, Heading, PageContainer, Text, TextAction } from "@starci/grammar/common"
import {
    UNSUBSCRIBE_ACTION_ROW_CLASS_NAME,
    UNSUBSCRIBE_COLUMN_CLASS_NAME,
    UNSUBSCRIBE_FOOTER_CLASS_NAME,
    UNSUBSCRIBE_HEADING_GROUP_CLASS_NAME,
} from "./classNames"

/** The closed state vocabulary of the signed-out unsubscribe surface. */
export const NOTIFY_UNSUBSCRIBE_STATES = ["idle", "pending", "unsubscribed", "refused"] as const

/** One member of the unsubscribe surface's state vocabulary. */
export type NotifyUnsubscribeState = (typeof NOTIFY_UNSUBSCRIBE_STATES)[number];

/** Every word the pure unsubscribe screen renders, resolved by the connected half. */
export type NotifyUnsubscribeViewCopy = {
  readonly brand: string;
  readonly legal: {
    readonly privacyPolicy: string;
    readonly terms: string;
  };
  /** The main landmark's accessible name. */
  readonly mainLabel: string;
  readonly heading: string;
  readonly tagline: string;
  readonly tokenMissing: string;
  readonly done: string;
  readonly refused: string;
  readonly action: string;
  readonly pending: string;
};

/** The view's complete contract: the lifecycle state, whether the link carried its token, every
 * word to draw, and the one action. */
export interface NotifyUnsubscribeViewProps {
  readonly state: NotifyUnsubscribeState;
  /** The link's `token` parameter was absent or empty, so the control cannot run. */
  readonly tokenMissing: boolean;
  readonly copy: NotifyUnsubscribeViewCopy;
  readonly onUnsubscribe: () => void;
}

/** The policy routes every screen's footer names; their labels are copy. */
const FOOTER_LINKS = [
    { key: "privacyPolicy", href: "/privacy-policy" },
    { key: "terms", href: "/terms" },
] as const

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
            <div role="main" aria-label={copy.mainLabel}>
                <PageContainer measure="product">
                    <div className={UNSUBSCRIBE_COLUMN_CLASS_NAME}>
                        <Text weight="semibold">{copy.brand}</Text>
                        <div className={UNSUBSCRIBE_HEADING_GROUP_CLASS_NAME}>
                            <Heading level={1}>{copy.heading}</Heading>
                            <Text tone="muted">{copy.tagline}</Text>
                        </div>
                        {tokenMissing ? (
                            <Text live="polite">{copy.tokenMissing}</Text>
                        ) : null}
                        {state === "unsubscribed" ? <Text live="polite">{copy.done}</Text> : null}
                        {state === "refused" ? (
                            <Text live="polite">{copy.refused}</Text>
                        ) : null}
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
                        <footer className={UNSUBSCRIBE_FOOTER_CLASS_NAME}>
                            {FOOTER_LINKS.map(link => (
                                <TextAction key={link.key} appearance="inline" href={link.href}>
                                    {copy.legal[link.key]}
                                </TextAction>
                            ))}
                        </footer>
                    </div>
                </PageContainer>
            </div>
        </GrammarRoot>
    )
}
