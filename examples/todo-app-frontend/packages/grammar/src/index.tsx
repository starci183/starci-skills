/**
 * The Grammar core: a small set of primitive leaves the product composes. Each one owns only intrinsic
 * rendering of its own markup and forwards standard DOM props; none of them read product data, session,
 * routing or transport. Theme colours live in ./styles.css, never inline here.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export interface GrammarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
}

export function GrammarButton({ children, className, ...rest }: GrammarButtonProps) {
  return (
    <button className={['grammar-button', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}

export interface GrammarTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
}

export function GrammarTextField({ label, id, className, ...rest }: GrammarTextFieldProps) {
  return (
    <div className="grammar-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={className} {...rest} />
    </div>
  );
}

export interface GrammarCardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function GrammarCard({ children, className }: GrammarCardProps) {
  return <div className={['grammar-card', className].filter(Boolean).join(' ')}>{children}</div>;
}

export interface GrammarMessageProps {
  readonly tone: 'danger';
  readonly children: ReactNode;
}

export function GrammarMessage({ tone, children }: GrammarMessageProps) {
  return <p className={`grammar-message-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>{children}</p>;
}
