import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

export type Concept = 'frame' | `C${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17}`;
export const concept: Concept = 'frame';

type Props<T extends ElementType> = { as?: T; concept: Concept; children: ReactNode } & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>;

/** The component boundary keeps the business concept visible in the rendered DOM. */
export function ConceptBlock<T extends ElementType = 'section'>({ as, concept: id, children, ...props }: Props<T>) {
  const Tag = as ?? 'section';
  return <Tag data-concept={id} {...props}>{children}</Tag>;
}
