import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskListView } from './component';
import type { Task } from '@/modules/api/tasks';

const noop = () => {};
const noopId = (_id: string) => {};
const noopToggle = (_id: string, _complete: boolean) => {};

const baseProps = {
  newTitle: '',
  isCreating: false,
  onNewTitleChange: noop,
  onCreate: noop,
  onToggleComplete: noopToggle,
  onDelete: noopId,
};

describe('TaskListView', () => {
  it('ui.task.list: empty state shows the no-tasks message', () => {
    render(<TaskListView {...baseProps} state="empty" tasks={[]} refusal={null} />);
    expect(screen.getByText('No tasks yet. Add the first one.')).toBeInTheDocument();
  });

  it('ui.task.list: one-task state renders exactly one row', () => {
    const tasks: Array<Task> = [{ id: '1', title: 'Buy milk', complete: false }];
    render(<TaskListView {...baseProps} state="one-task" tasks={tasks} refusal={null} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('ui.task.list: many-tasks state renders every row', () => {
    const tasks: Array<Task> = [
      { id: '1', title: 'Buy milk', complete: false },
      { id: '2', title: 'Walk dog', complete: true },
    ];
    render(<TaskListView {...baseProps} state="many-tasks" tasks={tasks} refusal={null} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('ui.task.list: refused state hides the list and the create form', () => {
    render(
      <TaskListView
        {...baseProps}
        state="refused"
        tasks={[]}
        refusal="Your session has ended. Sign in again to see your tasks."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Your session has ended.');
    expect(screen.queryByRole('button', { name: 'Add task' })).not.toBeInTheDocument();
  });

  it('ac.task.list.owned.excludes-others: renders only the rows it was given, not a wider set', () => {
    const tasks: Array<Task> = [{ id: 'mine', title: 'Mine only', complete: false }];
    render(<TaskListView {...baseProps} state="one-task" tasks={tasks} refusal={null} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('Someone else')).not.toBeInTheDocument();
  });

  it('ac.task.complete.once.is-reversible: toggling a complete task calls onToggleComplete with complete=false', () => {
    const onToggleComplete = vi.fn();
    const tasks: Array<Task> = [{ id: '1', title: 'Done already', complete: true }];
    render(
      <TaskListView {...baseProps} state="one-task" tasks={tasks} refusal={null} onToggleComplete={onToggleComplete} />,
    );
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    checkbox.click();
    expect(onToggleComplete).toHaveBeenCalledWith('1', false);
  });

  it('ac.task.title.required.refuses-empty: the add button stays disabled while the title is blank', () => {
    render(<TaskListView {...baseProps} state="empty" tasks={[]} refusal={null} newTitle="   " />);
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
  });
});
