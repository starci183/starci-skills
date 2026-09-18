import { SharePage } from '@/features/pages/share';

/** The route params Next hands this adapter: the task the share screen binds to. */
type PageProps = {
  readonly params: Promise<{ readonly taskId: string }>;
};

/** The route adapter that mounts the share feature and nothing else. */
const Page = async (props: PageProps) => {
  const params = await props.params;
  return <SharePage taskId={params.taskId} />;
};

export default Page;
