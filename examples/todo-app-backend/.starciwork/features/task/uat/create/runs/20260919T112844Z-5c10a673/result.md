# Create a task, and fail to delete somebody else's

Flow: `uat.task.create`  Run: `20260919T112844Z-5c10a673`  Outcome: pass

## Steps walked
- `owner-signed-in` (2026-09-19T11:28:45.379Z -> 2026-09-19T11:28:45.988Z)
- `task-created` (2026-09-19T11:28:46.062Z -> 2026-09-19T11:28:46.183Z)
- `stranger-delete-refused` (2026-09-19T11:28:46.215Z -> 2026-09-19T11:28:46.441Z)
- `owner-list-unchanged-and-cleaned-up` (2026-09-19T11:28:46.483Z -> 2026-09-19T11:28:46.856Z)

## Assertions
- `fr.task.create`: expected yes, observed yes - The created task's own title (uat-20260919T112844Z-5c10a673-task) appears in the owner's list.
- `br.task.single-owner`: expected yes, observed yes - The stranger's task list has no row for "uat-20260919T112844Z-5c10a673-task", so no delete affordance for it exists to click.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.