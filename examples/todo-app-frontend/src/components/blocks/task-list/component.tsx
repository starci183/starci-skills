import type { FormEvent } from 'react';
import { GrammarButton, GrammarMessage, GrammarTextField } from '@todo-app/grammar/index';
import type { Task } from '@/modules/api/tasks';
import { cardClassName, rowClassName } from './classNames';

/**
 * ui.task.list states: empty, one-task, many-tasks, refused. A state this record does not name has no
 * branch here - the record's `blockedBy` note about the rev-2 colour token is a capture-set gap, not a
 * license to add a fifth rendering path. The connected owner in ./index.tsx resolves which state applies
 * and hands it down explicitly; this view never re-derives it from the query result.
 */
export type TaskListState = 'empty' | 'one-task' | 'many-tasks' | 'refused';

/** The one beside-it inventory the TaskListState closed vocabulary is checked against. */
export const TASK_LIST_STATES: ReadonlyArray<TaskListState> = ['empty', 'one-task', 'many-tasks', 'refused'] as const;

/** The public props of the pure task list view. */
export type TaskListViewProps = {
  readonly state: TaskListState;
  readonly tasks: ReadonlyArray<Task>;
  readonly refusal: string | null;
  readonly newTitle: string;
  readonly isCreating: boolean;
  readonly onNewTitleChange: (value: string) => void;
  readonly onCreate: () => void;
  readonly onToggleComplete: (id: string, complete: boolean) => void;
  readonly onDelete: (id: string) => void;
};

/** The pure render of ui.task.list; every one of its four states is decided by the caller's `state`. */
export const TaskListView = (props: TaskListViewProps) => {
  const state = props.state;
  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onCreate();
  };

  return (
    <div className={cardClassName}>
      <div data-state={state}>
        {state === 'refused' ? (
          <GrammarMessage tone="danger">{props.refusal}</GrammarMessage>
        ) : (
          <>
            <form onSubmit={onCreate}>
              <GrammarTextField id="new-task-title" label="New task" value={props.newTitle} onChange={props.onNewTitleChange} />
              <GrammarButton type="submit" isDisabled={props.isCreating || !props.newTitle.trim()}>
                Add task
              </GrammarButton>
            </form>
            {state === 'empty' ? (
              <p>No tasks yet. Add the first one.</p>
            ) : (
              <ul>
                {props.tasks.map(task => (
                  <li key={task.id} className={rowClassName}>
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
    </div>
  );
};
