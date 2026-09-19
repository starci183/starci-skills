/* Lane v5-5 codemod plan: ui.task.list (components/blocks/task-list). */
module.exports = [
    {
        file: "src/components/blocks/task-list/component.tsx",
        ops: [
            ["sub", "label=\"New task\"", "label={copy.newTaskLabel}", 1, "tasks.newTaskLabel"],
            ["sub", "placeholder=\"What needs doing?\"", "placeholder={copy.newTaskPlaceholder}", 1, "tasks.newTaskPlaceholder"],
            ["line", "Add task", "{copy.addTask}", 1, "tasks.addTask"],
            ["line", "All tasks{\" \"}", "{copy.allTasks}{\" \"}", 1, "tasks.allTasks"],
            ["sub", "{taskCount} {taskCount === 1 ? \"task\" : \"tasks\"}", "{copy.formatTaskCount(taskCount)}", 1, "tasks.taskCount"],
            ["sub", ">No tasks yet. Add the first one.<", ">{copy.empty}<", 1, "tasks.empty"],
            ["line", "Delete \u201c{task.title}\u201d?", "{copy.formatDeleteConfirm(task.title)}", 1, "tasks.deleteConfirm"],
            ["line", "Delete", "{copy.delete}", 2, "tasks.delete"],
            ["line", "Cancel", "{copy.cancel}", 1, "tasks.cancel"],
            ["line", "Share", "{copy.share}", 1, "tasks.share"],
            ["line", "Schedule", "{copy.schedule}", 1, "tasks.schedule"],
            ["line", "Completed tasks stay here until you delete them.", "{copy.completedNote}", 1, "tasks.completedNote"],
        ],
    },
]
