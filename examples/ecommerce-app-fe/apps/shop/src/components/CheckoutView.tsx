'use client';

import { Button, SectionHeader, Text } from '@starci/grammar/common';
import { StateBlock } from './StateBlock';

/**
 * The checkout route's whole render. Checkout places an order against the order service for the
 * signed-in customer, and both its preconditions - the session handoff and a non-empty cart - are
 * backend contracts still being settled, so the route ships its honest blocked state rather than a
 * fabricated "order placed" success. The empty state is genuine, so the mascot is welcome.
 */
export const CheckoutView = () => (
  <>
    <SectionHeader title="Checkout" description="Review and place your order." level={1} />
    <StateBlock
      mascot
      title="Nothing to check out yet"
      description="Add items from browse and make sure you are signed in on your account."
    >
      <div className="flex gap-3">
        <Button href="/browse" variant="secondary" size="sm">
          Browse the catalogue →
        </Button>
        <Button href="/account" variant="secondary" size="sm">
          Your account →
        </Button>
      </div>
      <Text size="sm" tone="muted">
        Order submission opens once the session handoff and cart persistence land in the order
        service.
      </Text>
    </StateBlock>
  </>
);
