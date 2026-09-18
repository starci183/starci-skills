'use client';

import { Badge, SectionHeader, SurfaceListCard, Text } from '@starci/grammar/common';
import { StateBlock } from './StateBlock';
import { formatPrice } from '../modules/money';
import type { CurrentUser } from '../modules/api/identity';
import type { Order } from '../modules/api/orders';
import type { Result } from '../modules/api/result';
import type { BadgeTone } from '@starci/grammar/common';

type AccountViewProps = {
  readonly who: Result<CurrentUser | null>;
  readonly orders: Result<ReadonlyArray<Order>>;
  readonly identityApiUrl: string;
  readonly orderApiUrl: string;
};

const STATUS_TONE: Readonly<Record<Order['status'], BadgeTone>> = {
  open: 'accent',
  paid: 'success',
  shipped: 'neutral',
  cancelled: 'warning',
};

/**
 * The account route's whole render: who the shopper is, then the order history. An unreachable
 * service is an error surface (no mascot, per the brand's `neverIn`); a reachable service with
 * zero orders is a genuine empty state and the duck is welcome there.
 */
export const AccountView = ({ who, orders, identityApiUrl, orderApiUrl }: AccountViewProps) => {
  const accountLine = !who.ok
    ? `The account service at ${identityApiUrl} is not reachable (${who.reason}).`
    : who.data
      ? `Signed in as ${who.data.name} (${who.data.email}).`
      : 'You are browsing anonymously.';

  return (
    <>
      <SectionHeader title="Account" description={accountLine} level={1} />

      <div className="mt-8">
        {/*
          contract: anonymous browsing is only possible because the landing → shop session handoff
          is not settled yet; see modules/api/identity.ts. Until it is, an authenticated viewer is
          not invented client-side.
        */}
        {!orders.ok ? (
          <>
            <SectionHeader title="Order history" level={2} />
            <StateBlock
              title="No orders to show"
              description={`The order service at ${orderApiUrl} is not reachable (${orders.reason}).`}
            />
          </>
        ) : orders.data.length === 0 ? (
          <>
            <SectionHeader title="Order history" level={2} />
            <StateBlock
              mascot
              title="No orders yet"
              description="When you place an order it will be listed here."
            />
          </>
        ) : (
          <SurfaceListCard label="Order history" fact={`${orders.data.length}`}>
            {orders.data.map((order) => (
              <li className="starci-core-static-row items-center justify-between" key={order.id}>
                <span>
                  <Text as="span" weight="semibold">
                    Order {order.id}
                  </Text>{' '}
                  <Text as="span" size="sm" tone="muted">
                    · {order.lines.length} line{order.lines.length === 1 ? '' : 's'}
                  </Text>
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
                  <Text as="span" weight="semibold">
                    {formatPrice(order.totalCents, order.currency)}
                  </Text>
                </span>
              </li>
            ))}
          </SurfaceListCard>
        )}
      </div>
    </>
  );
};
