import { SignInFormBlock } from '@/components/blocks/sign-in-form';

/** The public entry of the sign-in feature; the app route mounts exactly this and nothing else. */
export function SignInPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <SignInFormBlock />
    </main>
  );
}
