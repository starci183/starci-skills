"use client"

import { TextAction } from "@starci/grammar/common"

/** The public props of the one routed-navigation leaf. */
export type LinkProps = {
  /** The in-app destination this link routes to; always an owned route path. */
  readonly to: string;
  /** The TextAction appearances the leaf forwards verbatim; kept in-repo so the contract is checkable. */
  readonly appearance?: "inline" | "muted" | "choice" | "route" | "tab" | "section" | "disclosure" | "plain";
  readonly size?: "xs" | "sm" | "md";
  readonly isCurrent?: boolean;
  readonly children: string;
};

/**
 * The one routed-navigation owner for internal destinations (starci-fe/no-internal-starci-href):
 * every in-app `<a>` a component renders is written here, so the navigation mechanism has a single
 * place to change. It stays a real browser destination - Grammar's own TextAction anchor - so
 * middle-click, copy-link and the link role come from the platform, exactly like the Heading leaf
 * keeps `<h1>`..`<h4>` semantics in one place.
 */
export const Link = (props: LinkProps) => (
    <TextAction href={props.to} appearance={props.appearance} size={props.size} isCurrent={props.isCurrent}>
        {props.children}
    </TextAction>
)
