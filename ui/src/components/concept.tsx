import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

/** The ids of the business concepts (C1 to C17) plus `frame` for shared chrome, used to tag each module and its DOM. */
export type Concept = 'frame' | `C${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17}`;
/** The business concept id (frame) under which the concept boundary component itself is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'frame';

type Props<T extends ElementType> = { as?: T; concept: Concept; children: ReactNode } & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>;

/** The component boundary keeps the business concept visible in the rendered DOM. */
export const ConceptBlock = <T extends ElementType = 'section'>({ as, concept: id, children, ...props }: Props<T>) => {
  const Tag = as ?? 'section';
  return <Tag data-concept={id} {...props}>{children}</Tag>;
};
