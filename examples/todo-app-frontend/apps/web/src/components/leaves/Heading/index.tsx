"use client"

import { Heading as GrammarHeading } from "@starci/grammar/common"

/**
 * The one place a heading's tag and its visual size are decided together, from a level
 * (TYPESET-1/TYPESET-2). Nothing else in the product renders `<h1>`..`<h4>` by hand; this leaf hands
 * the actual outline semantics and visual scale to Grammar's own Heading primitive.
 *
 * Marked as a client boundary because Grammar's own primitives pull in vendor client behavior
 * (React Aria) that a Server Component cannot import directly; the feature pages that mount this
 * leaf stay Server Components and render it as a Client Component, same as any other route.
 */
export type HeadingProps = {
  readonly level: 1 | 2 | 3 | 4;
  readonly children: string;
};

/** The one heading leaf; product code never writes an `<h1>`..`<h4>` tag directly. */
export const Heading = (props: HeadingProps) => <GrammarHeading level={props.level}>{props.children}</GrammarHeading>
