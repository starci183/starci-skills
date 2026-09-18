'use client';

import { useState } from 'react';
import { useSignIn } from '@/hooks';
import { SignInFormView } from './component';

/** SignInFormBlock takes no external props; the session and field state are entirely its own. */
export type SignInFormBlockProps = {};

/**
 * The connected owner of ui.login.sign-in: it holds the two field values as intrinsic form state, hands
 * the submit lifecycle to useSignIn (session/world), resolves the one state SignInFormView renders, and
 * hands every render path to the pure SignInFormView in ./component.tsx, which is the only place that
 * decides what the four states look like.
 */
export const SignInFormBlock = (props: SignInFormBlockProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submitting, refusal, submit } = useSignIn();

  return (
    <SignInFormView
      state={refusal ? 'refused' : submitting ? 'working' : email || password ? 'filled' : 'empty'}
      email={email}
      password={password}
      refusal={refusal}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={() => submit(email, password)}
    />
  );
};
