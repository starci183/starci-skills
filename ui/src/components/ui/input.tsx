import * as React from 'react';
import { Input as HeroInput } from '@heroui/react';

export function Input({ className, ...props }: React.ComponentProps<typeof HeroInput>) {
  return <HeroInput data-slot="input" variant="secondary" className={['st-input', className].filter(Boolean).join(' ')} {...props} />;
}
