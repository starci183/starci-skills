'use client';

import { Button, SectionHeader, Text } from '@starci/grammar/common';
import { StateBlock } from './StateBlock';

/**
 * The cart route's whole render. Cart persistence is deferred to the order-service session/cart
 * workstream (contract marker on the page), so the route ships its honest empty state - a genuine
 * empty surface, so the mascot is welcome - plus the note naming the contract still pending.
 */
export const CartView = () => (
  <>
    <SectionHeader title="Cart" description="What you are about to order." level={1} />
    <StateBlock
      mascot
      title="Your cart is empty"
      description="Items you add while browsing will appear here."
    >
      <Button href="/browse" variant="secondary" size="sm">
        Back to browse →
      </Button>
      <Text size="sm" tone="muted">
        Cart storage is not wired yet — it joins the order service in the same pass that settles
        sign-in.
      </Text>
    </StateBlock>
  </>
);
