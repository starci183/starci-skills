'use client';

import { GrammarRoot } from '@starci/grammar/common';
import { TaskListBlock } from '@/components/blocks/task-list';
import { Heading } from '@/components/leaves/Heading';

/**
 * The public entry of the task feature; the app route mounts exactly this and nothing else.
 *
 * Marked as a client boundary and wrapped in Grammar's own Common root: `@starci/grammar/common`
 * pulls in vendor client behavior (React Aria) that a Server Component cannot import, and the root
 * app layout stays a plain Server Component so it can keep exporting `metadata`.
 */
export const TasksPage = () => {
  return (
    <GrammarRoot>
      <main>
        <Heading level={1}>Your tasks</Heading>
        <TaskListBlock />
      </main>
    </GrammarRoot>
  );
};
