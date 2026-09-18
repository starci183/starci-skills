'use client';

import { useState } from 'react';
import { useTasks, useCreateTask, useSetTaskComplete, useDeleteTask } from '@/hooks/task';
import { TaskListView } from './component';

const READ_REFUSAL_MESSAGE = 'Your session has ended. Sign in again to see your tasks.';

/** TaskListBlock takes no external props; the query, mutations and draft state are entirely its own. */
export type TaskListBlockProps = {};

/**
 * The connected owner of ui.task.list: it owns the tasks query, the three mutations and the new-task
 * draft as intrinsic form state, resolves the one state TaskListView renders, and hands every render path
 * to the pure TaskListView in ./component.tsx.
 */
export const TaskListBlock = (props: TaskListBlockProps) => {
  const [newTitle, setNewTitle] = useState('');
  const tasksQuery = useTasks();
  const createTask = useCreateTask();
  const setTaskComplete = useSetTaskComplete();
  const deleteTask = useDeleteTask();

  const refusal = tasksQuery.error ? READ_REFUSAL_MESSAGE : null;

  const onCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    void createTask.trigger({ title }).then(() => {
      setNewTitle('');
      void tasksQuery.mutate();
    });
  };

  return (
    <TaskListView
      state={tasksQuery.error ? 'refused' : (tasksQuery.data?.length ?? 0) === 1 ? 'one-task' : (tasksQuery.data?.length ?? 0) > 1 ? 'many-tasks' : 'empty'}
      tasks={tasksQuery.data ?? []}
      refusal={refusal}
      newTitle={newTitle}
      isCreating={createTask.isMutating}
      isDeleting={deleteTask.isMutating}
      onNewTitleChange={setNewTitle}
      onCreate={onCreate}
      onToggleComplete={(id, complete) => {
        void setTaskComplete.trigger({ id, complete }).then(() => tasksQuery.mutate());
      }}
      onDelete={id => {
        void deleteTask.trigger({ id }).then(() => tasksQuery.mutate());
      }}
    />
  );
};
