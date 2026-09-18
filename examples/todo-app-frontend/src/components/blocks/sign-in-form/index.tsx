'use client';

import { useState } from 'react';
import { useSignIn } from '@/hooks';
import { SignInFormView } from './component';

/**
 * The connected owner of ui.login.sign-in: it holds the two field values as intrinsic form state and
 * hands the submit lifecycle to useSignIn (session/world). Every render path below reaches the pure
 * SignInFormView in ./component.tsx, which is the only place that decides what the four states look like.
 */
export function SignInFormBlock() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submitting, refusal, submit } = useSignIn();

  return (
    <SignInFormView
      email={email}
      password={password}
      submitting={submitting}
      refusal={refusal}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={() => submit(email, password)}
    />
  );
}
