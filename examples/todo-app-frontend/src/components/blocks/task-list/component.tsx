import type { FormEvent } from 'react';
import { Button, Input, SurfaceCard, Text } from '@starci/grammar/common';
import type { Task } from '@/modules/api/tasks';
import { TASK_LIST_BODY_CLASS_NAME, TASK_LIST_FORM_CLASS_NAME, TASK_LIST_ROWS_CLASS_NAME, TASK_LIST_ROW_CLASS_NAME } from './classNames';

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
    <SurfaceCard ariaLabel="Tasks" measure="formCompact">
      <div data-state={state} className={TASK_LIST_BODY_CLASS_NAME}>
        {state === 'refused' ? (
          <Text live="assertive">{props.refusal}</Text>
        ) : (
          <>
            <form onSubmit={onCreate} className={TASK_LIST_FORM_CLASS_NAME}>
              <Input
                id="new-task-title"
                name="title"
                label="New task"
                value={props.newTitle}
                onValueChange={props.onNewTitleChange}
              />
              <Button type="submit" variant="primary" isDisabled={props.isCreating || !props.newTitle.trim()}>
                Add task
              </Button>
            </form>
            {state === 'empty' ? (
              <Text tone="muted">No tasks yet. Add the first one.</Text>
            ) : (
              <ul className={TASK_LIST_ROWS_CLASS_NAME}>
                {props.tasks.map(task => (
                  <li key={task.id} className={TASK_LIST_ROW_CLASS_NAME}>
                    <label>
                      <input
                        type="checkbox"
                        checked={task.complete}
                        onChange={event => props.onToggleComplete(task.id, event.target.checked)}
                      />
                      {task.title}
                    </label>
                    <Button type="button" variant="ghost" onPress={() => props.onDelete(task.id)}>
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </SurfaceCard>
  );
};
