'use client';

import { useState } from 'react';
import { useSignIn } from '@/hooks/auth';
import { SignInScreenView } from './component';

/** SignInScreenBlock takes no external props; the session and field state are entirely its own. */
export type SignInScreenBlockProps = {};

/**
 * The connected owner of ui.login.sign-in: it holds the two field values as intrinsic form state,
 * hands the submit lifecycle to useSignIn (session/world), resolves the one state SignInScreenView
 * renders, and hands every render path to the pure SignInScreenView in ./component.tsx, which is the
 * only place that decides what the four states look like. The password is cleared once a submit
 * settles, because ui.login.sign-in's refused state keeps the email but asks for the password again;
 * a successful submit navigates away before the cleared value is ever seen.
 */
export const SignInScreenBlock = (props: SignInScreenBlockProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submitting, refusal, submit } = useSignIn();
  const onSubmit = () => {
    if (!email || !password) return;
    void submit(email, password).then(() => {
      setPassword('');
    });
  };

  return (
    <SignInScreenView
      state={refusal ? 'refused' : submitting ? 'working' : email || password ? 'filled' : 'empty'}
      email={email}
      password={password}
      refusal={refusal}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
    />
  );
};
