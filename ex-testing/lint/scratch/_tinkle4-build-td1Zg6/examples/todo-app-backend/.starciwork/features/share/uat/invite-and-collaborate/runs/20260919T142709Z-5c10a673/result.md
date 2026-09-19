# Invite an editor, have them complete a task, then revoke them

Flow: `uat.share.invite-and-collaborate`  Run: `20260919T142709Z-5c10a673`  Outcome: partial-pass

## Steps walked
- `owner-signed-in` (2026-09-19T14:27:10.531Z -> 2026-09-19T14:27:10.928Z)
- `task-created` (2026-09-19T14:27:10.977Z -> 2026-09-19T14:27:11.221Z)
- `editor-and-viewer-invited-pending` (2026-09-19T14:27:11.253Z -> 2026-09-19T14:27:11.547Z)
- `editor-sign-in-finds-no-accept-surface` (2026-09-19T14:27:11.605Z -> 2026-09-19T14:27:11.895Z)
- `owner-revokes-both-pending-invitations` (2026-09-19T14:27:11.938Z -> 2026-09-19T14:27:12.375Z)
- `task-deleted-and-invitation-rows-cleaned` (2026-09-19T14:27:12.426Z -> 2026-09-19T14:27:13.444Z)

## Assertions
- `fr.share.invite`: expected yes, observed yes - Two invitations submitted through ui.share.invite - demo2@todo.dev as editor, uat-20260919T142709Z-5c10a673-viewer@todo.dev as viewer - both render as Pending rows in the collaborator list. The realm seeds only two accounts, so the "third person" viewer is a run-namespaced address with no login; the invitation row itself is real.
- `fr.share.accept`: expected yes, observed not-run - No acceptance surface exists in the product: invite publishes no event and sends no email (src/modules/bussiness/share/invite.handler.ts), there is no notifications inbox, no route under src/app serves acceptInvitation, and no query lets an unbound invitee learn the invitationId - collaborators(taskId) returns [] to them (InvitationService.listFor). The shared task can never appear in the invitee list either (tasks is ownership-only). This step's screenshots are the observed absence. Signed in as the invited editor: the run task is absent from their list and the share route renders an empty state with nothing to accept.
- `br.share.role.permissions`: expected yes, observed not-run - Depends on an accepted invitation (unreachable above); even post-accept no UI affordance would exist, since a collaborator has no task surface to complete on.
- `fr.share.revoke`: expected yes, observed yes - The owner revoked both pending invitations through the UI (Revoke + window.confirm); each row now reads Revoked. This proves t-revoke-pending only - the record's designed leg revokes an accepted editor, which the missing accept surface makes unreachable.
- `br.share.revoke.on-read`: expected yes, observed not-run - Depends on an accepted collaborator whose next read is refused; no invitation could be accepted (missing surface above), so there is no bound access for a read to lose.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.