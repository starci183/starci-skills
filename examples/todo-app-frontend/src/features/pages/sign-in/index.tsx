import { SignInFormBlock } from '@/components/blocks/sign-in-form';
import { Heading } from '@/components/leaves/Heading';

/** The public entry of the sign-in feature; the app route mounts exactly this and nothing else. */
export const SignInPage = () => {
  return (
    <main>
      <Heading level={1}>Sign in</Heading>
      <SignInFormBlock />
    </main>
  );
};
