/**
 * The one place a heading's tag and its visual size are decided together, from a level
 * (TYPESET-1/TYPESET-2). Nothing else in the product renders `<h1>`..`<h4>` by hand.
 */
export type HeadingProps = {
  readonly level: 1 | 2 | 3 | 4;
  readonly children: string;
};

/** The one heading leaf; product code never writes an `<h1>`..`<h4>` tag directly. */
export const Heading = (props: HeadingProps) => {
  if (props.level === 1) return <h1>{props.children}</h1>;
  if (props.level === 2) return <h2>{props.children}</h2>;
  if (props.level === 3) return <h3>{props.children}</h3>;
  return <h4>{props.children}</h4>;
};
