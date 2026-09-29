import * as React from 'react';
import { Button as HeroButton } from '@heroui/react';

type Variant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
type Size = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
type Props = Omit<React.ComponentProps<typeof HeroButton>, 'variant' | 'size' | 'isDisabled' | 'onPress'> & {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

const variants = { default: 'primary', outline: 'outline', secondary: 'secondary', ghost: 'ghost', destructive: 'danger-soft', link: 'tertiary' } as const;

export function Button({ variant = 'default', size = 'default', disabled, className, ...props }: Props) {
  const icon = size.startsWith('icon');
  return <HeroButton
    data-slot="button"
    data-variant={variant}
    data-size={size}
    variant={variants[variant]}
    size={size === 'lg' || size === 'icon-lg' ? 'lg' : size === 'default' || size === 'icon' ? 'md' : 'sm'}
    isIconOnly={icon}
    isDisabled={disabled}
    className={['st-button', icon && 'st-button-icon', className].filter(Boolean).join(' ')}
    {...props}
  />;
}
