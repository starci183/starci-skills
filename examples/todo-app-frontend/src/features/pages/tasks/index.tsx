import { TaskListBlock } from '@/components/blocks/task-list';

/** The public entry of the task feature; the app route mounts exactly this and nothing else. */
export function TasksPage() {
  return (
    <main>
      <h1>Your tasks</h1>
      <TaskListBlock />
    </main>
  );
}
