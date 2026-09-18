import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Input, MediaFrame, SectionHeader, Text, TextAction } from '@starci/grammar/common';
import type { Task } from '@/modules/api/tasks';
import turtleMaster from './turtle-master.png';
import {
  TASK_LIST_BODY_CLASS_NAME,
  TASK_LIST_CHECKBOX_CLASS_NAME,
  TASK_LIST_CONFIRM_CLASS_NAME,
  TASK_LIST_DANGER_SCOPE_CLASS_NAME,
  TASK_LIST_EMPTY_CLASS_NAME,
  TASK_LIST_FIELD_CLASS_NAME,
  TASK_LIST_FORM_CLASS_NAME,
  TASK_LIST_MASCOT_FRAME_CLASS_NAME,
  TASK_LIST_ROW_ACTIONS_CLASS_NAME,
  TASK_LIST_ROW_CLASS_NAME,
  TASK_LIST_ROW_LABEL_CLASS_NAME,
  TASK_LIST_ROWS_CLASS_NAME,
  TASK_LIST_SECTION_CLASS_NAME,
} from './classNames';

/**
 * `next dev`/`next build` type this import as `StaticImageData`; Vitest resolves the same specifier to
 * a plain URL string. Both spellings are normalized once so either renderer gets a real `src`.
 */
const TURTLE_MASTER_SRC = typeof turtleMaster === 'string' ? turtleMaster : turtleMaster.src;

/**
 * ui.task.list states: empty, one-task, many-tasks, refused. A state this record does not name has no
 * branch here; the connected owner in ./index.tsx resolves which state applies and hands it down
 * explicitly - this view never re-derives it from the query result.
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
  readonly isDeleting: boolean;
  readonly onNewTitleChange: (value: string) => void;
  readonly onCreate: () => void;
  readonly onToggleComplete: (id: string, complete: boolean) => void;
  readonly onDelete: (id: string) => void;
};

/** The pure render of ui.task.list; every one of its four states is decided by the caller's `state`. */
export const TaskListView = (props: TaskListViewProps) => {
  const state = props.state;
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const focusReturnId = useRef<string | null>(null);
  const rowActions = useRef(new Map<string, HTMLElement>());

  /* A dismissed confirmation hands focus back to the Delete action that opened it, once the row's own
   * actions have rendered again. */
  useEffect(() => {
    if (confirmingId !== null || focusReturnId.current === null) return;
    const container = rowActions.current.get(focusReturnId.current);
    focusReturnId.current = null;
    container?.querySelector('button')?.focus();
  }, [confirmingId]);

  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    /* fr.task.create refuses an empty title at submit, so the primary action stays the direction's
     * full-accent button at rest instead of a disabled control the direction never drew. */
    if (!props.newTitle.trim()) return;
    props.onCreate();
  };
  const onCancelDelete = (id: string) => {
    focusReturnId.current = id;
    setConfirmingId(null);
  };

  const taskCount = props.tasks.length;

  return (
    <div data-state={state} className={TASK_LIST_BODY_CLASS_NAME}>
      {state === 'refused' ? (
        <Text live="assertive">{props.refusal}</Text>
      ) : (
        <>
          <form onSubmit={onCreate} className={TASK_LIST_FORM_CLASS_NAME}>
            <div className={TASK_LIST_FIELD_CLASS_NAME}>
              <Input
                id="new-task-title"
                name="title"
                label="New task"
                placeholder="What needs doing?"
                value={props.newTitle}
                onValueChange={props.onNewTitleChange}
              />
            </div>
            <Button type="submit" variant="primary" isDisabled={props.isCreating} isPending={props.isCreating}>
              Add task
            </Button>
          </form>
          <section aria-labelledby="all-tasks-heading" className={TASK_LIST_SECTION_CLASS_NAME}>
            <SectionHeader
              level={2}
              id="all-tasks-heading"
              title={
                <>
                  All tasks{' '}
                  {taskCount > 0 ? (
                    <Text as="span" size="sm" tone="muted">
                      {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                    </Text>
                  ) : null}
                </>
              }
            />
            {state === 'empty' ? (
              <div className={TASK_LIST_EMPTY_CLASS_NAME}>
                <MediaFrame aspect="square" fit="contain" treatment="plain" className={TASK_LIST_MASCOT_FRAME_CLASS_NAME}>
                  <img src={TURTLE_MASTER_SRC} alt="" />
                </MediaFrame>
                <Text tone="muted">No tasks yet. Add the first one.</Text>
              </div>
            ) : (
              <>
                <ul className={TASK_LIST_ROWS_CLASS_NAME}>
                  {props.tasks.map(task => {
                    const confirming = confirmingId === task.id;
                    return (
                      <li key={task.id} className={TASK_LIST_ROW_CLASS_NAME}>
                        <label className={TASK_LIST_ROW_LABEL_CLASS_NAME}>
                          <input
                            type="checkbox"
                            checked={task.complete}
                            className={TASK_LIST_CHECKBOX_CLASS_NAME}
                            onChange={event => props.onToggleComplete(task.id, event.target.checked)}
                          />
                          <Text as="span" tone={task.complete ? 'muted' : 'default'} isSuperseded={task.complete} overflow="truncate">
                            {task.title}
                          </Text>
                        </label>
                        <div
                          className={confirming ? TASK_LIST_CONFIRM_CLASS_NAME : TASK_LIST_ROW_ACTIONS_CLASS_NAME}
                          ref={element => {
                            if (element) rowActions.current.set(task.id, element);
                            else rowActions.current.delete(task.id);
                          }}
                        >
                          {confirming ? (
                            <>
                              <Text as="span" size="sm">
                                Delete “{task.title}”?
                              </Text>
                              <span className={TASK_LIST_DANGER_SCOPE_CLASS_NAME}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  isDisabled={props.isDeleting}
                                  onPress={() => props.onDelete(task.id)}
                                >
                                  Delete
                                </Button>
                              </span>
                              <Button type="button" variant="secondary" isDisabled={props.isDeleting} onPress={() => onCancelDelete(task.id)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <TextAction appearance="inline" href={`/tasks/${task.id}/share`}>
                                Share
                              </TextAction>
                              <TextAction appearance="inline" href={`/tasks/${task.id}/schedule`}>
                                Schedule
                              </TextAction>
                              <span className={TASK_LIST_DANGER_SCOPE_CLASS_NAME}>
                                <Button type="button" variant="outline" onPress={() => setConfirmingId(task.id)}>
                                  Delete
                                </Button>
                              </span>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Text tone="muted" size="sm">
                  Completed tasks stay here until you delete them.
                </Text>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};
