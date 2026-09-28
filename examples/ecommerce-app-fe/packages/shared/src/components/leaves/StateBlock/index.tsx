"use client"

import type { ReactNode } from "react"
import { EmptyNotice } from "@starci/grammar/common"
import { DuckMascot } from "../DuckMascot"
import { stateBlockClassNames } from "./classNames"

export type StateBlockProps = {
  readonly title: string;
  readonly description?: string;
  /**
   * The brand mascot joins only genuine empty states (`mayAppearIn`: empty states, welcome
   * surfaces). Refusal and error surfaces are the record's `neverIn` - pass `mascot` only where
   * the surface is truly an empty one, never on a service-unavailable or danger render.
   */
  readonly mascot?: boolean;
  readonly children?: ReactNode;
};

/**
 * The honest "nothing to show" surface every gated route falls back to, drawn with grammar's
 * `EmptyNotice`. `description` states *why* there is nothing (the service reason, or the contract
 * still pending) so the page never reads as a silent blank.
 */
export const StateBlock = (props: StateBlockProps) => (
    <div className={stateBlockClassNames.frame}>
        <EmptyNotice
            message={props.title}
            description={props.description}
            iconSource={props.mascot ? DuckMascot : undefined}
        />
        {props.children}
    </div>
)
