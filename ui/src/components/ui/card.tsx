import * as React from 'react';
import { Card as HeroCard } from '@heroui/react';

export function Card({ size = 'default', className, children, ...props }: React.ComponentProps<'div'> & { size?: 'default' | 'sm' }) {
  return <HeroCard data-slot="card" data-size={size} variant="default" className={['st-card', className].filter(Boolean).join(' ')} {...props}>{children}</HeroCard>;
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <HeroCard.Header data-slot="card-header" className={['st-card-header', className].filter(Boolean).join(' ')} {...props} />;
}
export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <HeroCard.Title data-slot="card-title" className={['st-card-title', className].filter(Boolean).join(' ')} {...props} />;
}
export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <HeroCard.Description data-slot="card-description" className={className} {...props} />;
}
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <HeroCard.Content data-slot="card-content" className={['st-card-content', className].filter(Boolean).join(' ')} {...props} />;
}
export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <HeroCard.Footer data-slot="card-footer" className={['st-card-footer', className].filter(Boolean).join(' ')} {...props} />;
}
