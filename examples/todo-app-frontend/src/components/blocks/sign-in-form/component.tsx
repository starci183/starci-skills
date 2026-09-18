import type { FormEvent } from 'react';
import { Button, Input, SurfaceCard, Text } from '@starci/grammar/common';
import { SIGN_IN_FORM_FIELDS_CLASS_NAME } from './classNames';

/**
 * ui.login.sign-in states: empty, filled, refused, working. Every branch below is one of those four
 * names; there is no fifth rendering path and no attempt to say which half of the pair was wrong when
 * refused, because br.login.password.sign-in must read identically for both refusal causes. The connected
 * owner in ./index.tsx resolves which state applies and hands it down explicitly.
 */
export type SignInFormState = 'empty' | 'filled' | 'refused' | 'working';

/** The one beside-it inventory the SignInFormState closed vocabulary is checked against. */
export const SIGN_IN_FORM_STATES: ReadonlyArray<SignInFormState> = ['empty', 'filled', 'refused', 'working'] as const;

/** The public props of the pure sign-in form view. */
export type SignInFormViewProps = {
  readonly state: SignInFormState;
  readonly email: string;
  readonly password: string;
  readonly refusal: string | null;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: () => void;
};

/** The pure render of ui.login.sign-in; every one of its four states is decided by the caller's `state`. */
export const SignInFormView = (props: SignInFormViewProps) => {
  const state = props.state;
  const isWorking = state === 'working';
  const disabled = isWorking || !(props.email && props.password);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onSubmit();
  };
  return (
    <SurfaceCard ariaLabel="Sign in" measure="formCompact">
      <form onSubmit={onSubmit} data-state={state} className={SIGN_IN_FORM_FIELDS_CLASS_NAME}>
        <Input
          id="sign-in-email"
          name="email"
          label="Email"
          kind="email"
          value={props.email}
          isDisabled={isWorking}
          onValueChange={props.onEmailChange}
        />
        <Input
          id="sign-in-password"
          name="password"
          label="Password"
          kind="password"
          value={props.password}
          isDisabled={isWorking}
          onValueChange={props.onPasswordChange}
        />
        {state === 'refused' ? <Text live="assertive">{props.refusal}</Text> : null}
        <Button type="submit" variant="primary" width="fill" isDisabled={disabled} isPending={isWorking}>
          {isWorking ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </SurfaceCard>
  );
};
