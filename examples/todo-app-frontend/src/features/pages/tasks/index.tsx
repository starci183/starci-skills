import { TaskListBlock } from '@/components/blocks/task-list';
import { Heading } from '@/components/leaves/Heading';

/** The public entry of the task feature; the app route mounts exactly this and nothing else. */
export const TasksPage = () => {
  return (
    <main>
      <Heading level={1}>Your tasks</Heading>
      <TaskListBlock />
    </main>
  );
};
