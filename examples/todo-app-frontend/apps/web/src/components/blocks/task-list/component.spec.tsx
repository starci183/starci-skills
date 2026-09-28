import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { TaskListView } from "./component"
import type { Task } from "@/modules/api/tasks"

const noop = () => {}

const baseProps = {
    newTitle: "",
    isCreating: false,
    isDeleting: false,
    copy: {
        newTaskLabel: "New task",
        newTaskPlaceholder: "What needs doing?",
        addTask: "Add task",
        allTasks: "All tasks",
        formatTaskCount: (count: number) => `${count} ${count === 1 ? "task" : "tasks"}`,
        empty: "No tasks yet. Add the first one.",
        formatDeleteConfirm: (title: string) => `Delete “${title}”?`,
        delete: "Delete",
        cancel: "Cancel",
        share: "Share",
        schedule: "Schedule",
        completedNote: "Completed tasks stay here until you delete them.",
    },
    onNewTitleChange: noop,
    onCreate: noop,
    onToggleComplete: noop,
    onDelete: noop,
}

describe("TaskListView", () => {
    it("ui.task.list: empty state shows the no-tasks message", () => {
        render(<TaskListView {...baseProps} state="empty" tasks={[]} refusal={null} />)
        expect(screen.getByText("No tasks yet. Add the first one.")).toBeInTheDocument()
    })

    it("ui.task.list: empty state shows the brand turtle master as decorative artwork", () => {
        const { container } = render(<TaskListView {...baseProps} state="empty" tasks={[]} refusal={null} />)
        const turtle = container.querySelector("img")
        expect(turtle).not.toBeNull()
        expect(turtle).toHaveAttribute("alt", "")
    })

    it("ui.task.list: one-task state renders exactly one row", () => {
        const tasks: Array<Task> = [{ id: "1", title: "Buy milk", complete: false }]
        render(<TaskListView {...baseProps} state="one-task" tasks={tasks} refusal={null} />)
        expect(screen.getAllByRole("listitem")).toHaveLength(1)
        expect(screen.getByText("Buy milk")).toBeInTheDocument()
    })

    it("ui.task.list: many-tasks state renders every row", () => {
        const tasks: Array<Task> = [
            { id: "1", title: "Buy milk", complete: false },
            { id: "2", title: "Walk dog", complete: true },
        ]
        render(<TaskListView {...baseProps} state="many-tasks" tasks={tasks} refusal={null} />)
        expect(screen.getAllByRole("listitem")).toHaveLength(2)
    })

    it("ui.task.list: the collection is a section headed \"All tasks\" with the task count", () => {
        const tasks: Array<Task> = [
            { id: "1", title: "Buy milk", complete: false },
            { id: "2", title: "Walk dog", complete: true },
        ]
        render(<TaskListView {...baseProps} state="many-tasks" tasks={tasks} refusal={null} />)
        const section = screen.getByRole("region", { name: /All tasks/ })
        expect(section).toHaveTextContent("2 tasks")
    })

    it("ui.task.list: every row carries Share and Schedule destinations bound to its own task", () => {
        const tasks: Array<Task> = [{ id: "task-7", title: "Buy milk", complete: false }]
        render(<TaskListView {...baseProps} state="one-task" tasks={tasks} refusal={null} />)
        expect(screen.getByRole("link", { name: "Share" })).toHaveAttribute("href", "/tasks/task-7/share")
        expect(screen.getByRole("link", { name: "Schedule" })).toHaveAttribute("href", "/tasks/task-7/schedule")
    })

    it("ui.task.list: Delete asks an inline confirmation naming the task before calling onDelete", () => {
        const onDelete = vi.fn()
        const tasks: Array<Task> = [{ id: "1", title: "Buy milk", complete: false }]
        render(<TaskListView {...baseProps} state="one-task" tasks={tasks} refusal={null} onDelete={onDelete} />)
        fireEvent.click(screen.getByRole("button", { name: "Delete" }))
        expect(screen.getByText(/Delete “Buy milk”\?/)).toBeInTheDocument()
        expect(onDelete).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole("button", { name: "Delete" }))
        expect(onDelete).toHaveBeenCalledWith("1")
    })

    it("ui.task.list: Cancel dismisses the confirmation without deleting and returns focus to Delete", () => {
        const onDelete = vi.fn()
        const tasks: Array<Task> = [{ id: "1", title: "Buy milk", complete: false }]
        render(<TaskListView {...baseProps} state="one-task" tasks={tasks} refusal={null} onDelete={onDelete} />)
        fireEvent.click(screen.getByRole("button", { name: "Delete" }))
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
        expect(onDelete).not.toHaveBeenCalled()
        expect(screen.queryByText(/Delete “Buy milk”\?/)).not.toBeInTheDocument()
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete" }))
    })

    it("ui.task.list: refused state hides the list and the create form", () => {
        render(
            <TaskListView
                {...baseProps}
                state="refused"
                tasks={[]}
                refusal="Your session has ended. Sign in again to see your tasks."
            />,
        )
        expect(screen.getByRole("alert")).toHaveTextContent("Your session has ended.")
        expect(screen.queryByRole("button", { name: "Add task" })).not.toBeInTheDocument()
    })

    it("ui.task.list: refused state shows no collection and no mascot", () => {
        const { container } = render(
            <TaskListView
                {...baseProps}
                state="refused"
                tasks={[]}
                refusal="Your session has ended. Sign in again to see your tasks."
            />,
        )
        expect(screen.queryByRole("region", { name: /All tasks/ })).not.toBeInTheDocument()
        expect(container.querySelector("img")).toBeNull()
    })

    it("ac.task.list.owned.excludes-others: renders only the rows it was given, not a wider set", () => {
        const tasks: Array<Task> = [{ id: "mine", title: "Mine only", complete: false }]
        render(<TaskListView {...baseProps} state="one-task" tasks={tasks} refusal={null} />)
        expect(screen.getAllByRole("listitem")).toHaveLength(1)
        expect(screen.queryByText("Someone else")).not.toBeInTheDocument()
    })

    it("ac.task.complete.once.is-reversible: toggling a complete task calls onToggleComplete with complete=false", () => {
        const onToggleComplete = vi.fn()
        const tasks: Array<Task> = [{ id: "1", title: "Done already", complete: true }]
        render(
            <TaskListView {...baseProps} state="one-task" tasks={tasks} refusal={null} onToggleComplete={onToggleComplete} />,
        )
        const checkbox = screen.getByRole("checkbox") as HTMLInputElement
        expect(checkbox.checked).toBe(true)
        checkbox.click()
        expect(onToggleComplete).toHaveBeenCalledWith("1", false)
    })

    it("ac.task.title.required.refuses-empty: a blank title submits nothing", () => {
        const onCreate = vi.fn()
        render(<TaskListView {...baseProps} state="empty" tasks={[]} refusal={null} newTitle="   " onCreate={onCreate} />)
        fireEvent.click(screen.getByRole("button", { name: "Add task" }))
        expect(onCreate).not.toHaveBeenCalled()
    })
})
