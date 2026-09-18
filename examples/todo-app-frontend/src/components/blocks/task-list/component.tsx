import type { FormEvent } from 'react';
import { GrammarButton, GrammarCard, GrammarMessage, GrammarTextField } from '@todo-app/grammar/index';
import type { Task } from '@/modules/api/tasks';

/**
 * ui.task.list states: empty, one-task, many-tasks, refused. A state this record does not name has no
 * branch here - the record's `blockedBy` note about the rev-2 colour token is a capture-set gap, not a
 * license to add a fifth rendering path.
 */
export type TaskListState = 'empty' | 'one-task' | 'many-tasks' | 'refused';

export interface TaskListViewProps {
  readonly tasks: readonly Task[];
  readonly refusal: string | null;
  readonly newTitle: string;
  readonly creating: boolean;
  readonly onNewTitleChange: (value: string) => void;
  readonly onCreate: () => void;
  readonly onToggleComplete: (id: string, complete: boolean) => void;
  readonly onDelete: (id: string) => void;
}

export function taskListState(props: Pick<TaskListViewProps, 'tasks' | 'refusal'>): TaskListState {
  if (props.refusal) return 'refused';
  return props.tasks.length === 1 ? 'one-task' : props.tasks.length > 1 ? 'many-tasks' : 'empty';
}

export function TaskListView(props: TaskListViewProps) {
  const state = taskListState(props);
  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onCreate();
  };

  return (
    <GrammarCard>
      <div data-state={state}>
        {state === 'refused' ? (
          <GrammarMessage tone="danger">{props.refusal}</GrammarMessage>
        ) : (
          <>
            <form onSubmit={handleCreate}>
              <GrammarTextField
                id="new-task-title"
                label="New task"
                value={props.newTitle}
                onChange={event => props.onNewTitleChange(event.target.value)}
              />
              <GrammarButton type="submit" disabled={props.creating || !props.newTitle.trim()}>
                Add task
              </GrammarButton>
            </form>
            {state === 'empty' ? (
              <p>No tasks yet. Add the first one.</p>
            ) : (
              <ul>
                {props.tasks.map(task => (
                  <li key={task.id} className="grammar-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={task.complete}
                        onChange={event => props.onToggleComplete(task.id, event.target.checked)}
                      />
                      {task.title}
                    </label>
                    <GrammarButton type="button" onClick={() => props.onDelete(task.id)}>
                      Delete
                    </GrammarButton>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </GrammarCard>
  );
}
