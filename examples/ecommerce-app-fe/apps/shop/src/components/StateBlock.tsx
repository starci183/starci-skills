import type { ReactNode } from 'react';

type StateBlockProps = {
  readonly title: string;
  readonly children?: ReactNode;
};

/**
 * The honest "nothing to show" surface every gated route falls back to. `children` states *why* there is
 * nothing (the service reason, or the contract still pending) so the page never reads as a silent blank.
 */
export const StateBlock = ({ title, children }: StateBlockProps) => (
  <div className="empty">
    <h3>{title}</h3>
    {children ? <p className="muted" style={{ margin: 0 }}>{children}</p> : null}
  </div>
);
