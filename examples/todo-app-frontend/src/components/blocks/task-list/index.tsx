'use client';

import { useState } from 'react';
import { useTasks, useCreateTask, useSetTaskComplete, useDeleteTask } from '@/hooks';
import { TaskListView } from './component';

const READ_REFUSAL_MESSAGE = 'Your session has ended. Sign in again to see your tasks.';

/**
 * The connected owner of ui.task.list: it owns the tasks query, the three mutations and the new-task
 * draft as intrinsic form state, then hands every render path to the pure TaskListView in ./component.tsx.
 */
export function TaskListBlock() {
  const [newTitle, setNewTitle] = useState('');
  const tasksQuery = useTasks();
  const createTask = useCreateTask();
  const setTaskComplete = useSetTaskComplete();
  const deleteTask = useDeleteTask();

  const refusal = tasksQuery.error ? READ_REFUSAL_MESSAGE : null;

  const handleCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    void createTask.trigger({ title }).then(() => {
      setNewTitle('');
      void tasksQuery.mutate();
    });
  };

  return (
    <TaskListView
      tasks={tasksQuery.data ?? []}
      refusal={refusal}
      newTitle={newTitle}
      creating={createTask.isMutating}
      onNewTitleChange={setNewTitle}
      onCreate={handleCreate}
      onToggleComplete={(id, complete) => {
        void setTaskComplete.trigger({ id, complete }).then(() => tasksQuery.mutate());
      }}
      onDelete={id => {
        void deleteTask.trigger({ id }).then(() => tasksQuery.mutate());
      }}
    />
  );
}
