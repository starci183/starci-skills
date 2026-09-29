import * as React from 'react';
import { Chip } from '@heroui/react';

type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';

export function Badge({ variant = 'default', className, children, ...props }: React.ComponentProps<'span'> & { variant?: Variant }) {
  return <Chip {...props} data-slot="badge" data-variant={variant} color={variant === 'destructive' ? 'danger' : variant === 'default' ? 'accent' : 'default'} variant={variant === 'outline' ? 'secondary' : variant === 'ghost' || variant === 'link' ? 'tertiary' : 'soft'} size="sm" className={['st-badge', className].filter(Boolean).join(' ')}>{children}</Chip>;
}
