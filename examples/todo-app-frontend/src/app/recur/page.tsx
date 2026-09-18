import { RecurSchedulePage } from '@/components/recur';
import './recur.css';

type PageProps = {
  readonly searchParams?: Promise<{ readonly task?: string | ReadonlyArray<string> }>;
};

/**
 * The route adapter that mounts the recur schedule feature and nothing else.
 *
 * ui.recur.schedule's surface route is the task's own schedule; the example backend's
 * makeRecurring contract identifies the task by its title (there is no taskId-to-rule lookup),
 * so the route binds it as ?task=<title> rather than inventing an id the API cannot resolve.
 */
const Page = async (props: PageProps) => {
  const task = (await props.searchParams)?.task;
  const taskTitle = Array.isArray(task) ? task[0] : task;
  return <RecurSchedulePage taskTitle={typeof taskTitle === 'string' && taskTitle !== '' ? taskTitle : null} />;
};

export default Page;
