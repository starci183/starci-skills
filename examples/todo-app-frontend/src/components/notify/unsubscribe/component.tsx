import { Button, GrammarRoot, Heading, PageContainer, Text, TextAction } from '@starci/grammar/common';
import {
  UNSUBSCRIBE_ACTION_ROW_CLASS_NAME,
  UNSUBSCRIBE_COLUMN_CLASS_NAME,
  UNSUBSCRIBE_FOOTER_CLASS_NAME,
  UNSUBSCRIBE_HEADING_GROUP_CLASS_NAME,
} from './classNames';

/** The closed state vocabulary of the signed-out unsubscribe surface. */
export const NOTIFY_UNSUBSCRIBE_STATES = ['idle', 'pending', 'unsubscribed', 'refused'] as const;

/** One member of the unsubscribe surface's state vocabulary. */
export type NotifyUnsubscribeState = (typeof NOTIFY_UNSUBSCRIBE_STATES)[number];

/** The view's complete contract: the lifecycle state, whether the link carried its token, and the
 * one action. */
export interface NotifyUnsubscribeViewProps {
  readonly state: NotifyUnsubscribeState;
  /** The link's `token` parameter was absent or empty, so the control cannot run. */
  readonly tokenMissing: boolean;
  readonly onUnsubscribe: () => void;
}

const FOOTER_LINKS = [
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
] as const;

/**
 * The pure render of the derived unsubscribe-link screen: a signed-out projection of
 * ui.notify.preferences' coverage map, so it keeps the product name and policy footer but drops
 * the authenticated shell, navigation and Alex. No hooks, no transport, no world state.
 */
export const NotifyUnsubscribeView = (props: NotifyUnsubscribeViewProps) => {
  const { state, tokenMissing } = props;

  return (
    <GrammarRoot data-state={state}>
      <div role="main" aria-label="The email unsubscribe screen">
        <PageContainer measure="product">
          <div className={UNSUBSCRIBE_COLUMN_CLASS_NAME}>
            <Text weight="semibold">Todo app</Text>
            <div className={UNSUBSCRIBE_HEADING_GROUP_CLASS_NAME}>
              <Heading level={1}>Unsubscribe from email</Heading>
              <Text tone="muted">Stop the task digest for this address.</Text>
            </div>
            {tokenMissing ? (
              <Text live="polite">This unsubscribe link is missing its token.</Text>
            ) : null}
            {state === 'unsubscribed' ? <Text live="polite">You are unsubscribed from email.</Text> : null}
            {state === 'refused' ? (
              <Text live="polite">We could not unsubscribe you. This link may have expired.</Text>
            ) : null}
            <div className={UNSUBSCRIBE_ACTION_ROW_CLASS_NAME}>
              <Button
                variant="secondary"
                isDisabled={tokenMissing || state === 'pending' || state === 'unsubscribed'}
                isPending={state === 'pending'}
                onPress={props.onUnsubscribe}
              >
                {state === 'pending' ? 'Unsubscribing…' : 'Unsubscribe from email'}
              </Button>
            </div>
            <footer className={UNSUBSCRIBE_FOOTER_CLASS_NAME}>
              {FOOTER_LINKS.map(link => (
                <TextAction key={link.label} appearance="inline" href={link.href}>
                  {link.label}
                </TextAction>
              ))}
            </footer>
          </div>
        </PageContainer>
      </div>
    </GrammarRoot>
  );
};
