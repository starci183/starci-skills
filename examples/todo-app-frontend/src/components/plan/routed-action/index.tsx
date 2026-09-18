import { TextAction, type TextActionAppearance } from '@starci/grammar/common';

/**
 * The one place the plan feature hands an internal route to a Grammar action
 * (starci-fe/no-internal-starci-href): callers supply the route identity, this owner decides how it
 * becomes a real anchor - today Grammar's TextAction destination semantics, so middle-click and the
 * link role stay the platform's. If the app later routes internal links through the client router,
 * it changes here once.
 */
export type PlanRoutedActionProps = {
  readonly route: string;
  readonly appearance?: TextActionAppearance;
  readonly isCurrent?: boolean;
  readonly onFollow?: () => void;
  readonly children: string;
};

/** The routed navigation owner for the plan feature's internal destinations. */
export const PlanRoutedAction = (props: PlanRoutedActionProps) => (
  <TextAction
    appearance={props.appearance}
    href={props.route}
    isCurrent={props.isCurrent}
    onFollow={props.onFollow}
  >
    {props.children}
  </TextAction>
);
