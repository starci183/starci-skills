import { Suspense } from 'react';
import { NotifyUnsubscribeBlock } from '@/components/notify/unsubscribe';

/**
 * The route adapter that mounts the signed-out email unsubscribe surface (the unsubscribe-link
 * projection in ui.notify.preferences' coverage map) and nothing else. Suspense wraps the block
 * because its link-token read uses useSearchParams.
 */
const Page = () => {
  return (
    <Suspense>
      <NotifyUnsubscribeBlock />
    </Suspense>
  );
};

export default Page;
