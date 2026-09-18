import type { FormEvent } from 'react';
import { GrammarButton, GrammarCard, GrammarMessage, GrammarTextField } from '@todo-app/grammar/index';

/**
 * ui.login.sign-in states: empty, filled, refused, working. Every branch below is one of those four
 * names; there is no fifth rendering path and no attempt to say which half of the pair was wrong when
 * refused, because br.login.password.sign-in must read identically for both refusal causes.
 */
export type SignInFormState = 'empty' | 'filled' | 'refused' | 'working';

export interface SignInFormProps {
  readonly email: string;
  readonly password: string;
  readonly submitting: boolean;
  readonly refusal: string | null;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: () => void;
}

export function signInFormState(props: Pick<SignInFormProps, 'email' | 'password' | 'submitting' | 'refusal'>): SignInFormState {
  if (props.submitting) return 'working';
  if (props.refusal) return 'refused';
  return props.email || props.password ? 'filled' : 'empty';
}

export function SignInFormView(props: SignInFormProps) {
  const state = signInFormState(props);
  const disabled = state === 'working' || !(props.email && props.password);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onSubmit();
  };
  return (
    <GrammarCard>
      <form onSubmit={handleSubmit} data-state={state}>
        <GrammarTextField
          id="sign-in-email"
          label="Email"
          type="email"
          value={props.email}
          onChange={event => props.onEmailChange(event.target.value)}
        />
        <GrammarTextField
          id="sign-in-password"
          label="Password"
          type="password"
          value={props.password}
          onChange={event => props.onPasswordChange(event.target.value)}
        />
        {state === 'refused' ? <GrammarMessage tone="danger">{props.refusal}</GrammarMessage> : null}
        <GrammarButton type="submit" disabled={disabled}>
          {state === 'working' ? 'Signing in...' : 'Sign in'}
        </GrammarButton>
      </form>
    </GrammarCard>
  );
}
