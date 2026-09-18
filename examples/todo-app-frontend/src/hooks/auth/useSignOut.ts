import { useRouter } from 'next/navigation';
import { clearToken } from '@/modules/session';

/**
 * The one sign-out action the workspace shell's "Sign out" destination runs: drops the session token
 * (which also disables every session-gated SWR key) and lands the person back on the sign-in route,
 * the mirror of useSignIn's successful navigation to `/tasks`.
 */
export const useSignOut = () => {
  const router = useRouter();
  return () => {
    clearToken();
    router.push('/sign-in');
  };
};
