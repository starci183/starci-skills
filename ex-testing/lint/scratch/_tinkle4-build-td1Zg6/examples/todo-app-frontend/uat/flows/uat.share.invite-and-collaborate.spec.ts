import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { readAccounts, readFlowRecord } from '../lib/flow-records';
import { currentRunId, LIVE_LOGIN_AUTHORIZED, passwordFor } from '../lib/run-context';
import { recordAssertion, recordResource, walkStep } from '../lib/steps';

const FEATURE = 'share';
const FLOW = 'invite-and-collaborate';
const record = readFlowRecord(FEATURE, FLOW);

const API_BASE_URL = process.env.UAT_API_BASE_URL ?? 'http://localhost:3001';

/**
 * The record's own cleanup line - "delete the run-owned task, invitation and access rows by recorded
 * id" - is honored literally: task deletion does not cascade to invitation rows (the invitations table
 * has no foreign key, see migration 1758160000002-create-invitations-table.ts and TaskService.delete,
 * which deletes only the task row), so the run-owned invitation rows are removed by their exact
 * recorded ids after the UI half of cleanup. environment.todo-app.dev's allowedEffects authorizes
 * exactly this ("delete run-owned rows by exact recorded id"). The container/database belong to
 * whoever booted the shared stack, not to this harness, so both come from the environment.
 */
const PG_CONTAINER = process.env.UAT_PG_CONTAINER ?? 'compose-postgres-1';
const PG_DATABASE = process.env.UAT_PG_DATABASE ?? 'todo';

/** Same correctly-headed read-back convention as uat.login.sign-in's apiListTasks: used only to learn
 * the invitation ids the UI never displays, so cleanup can name them by recorded id. The browser is
 * still what every recorded UX/business observation is read from. */
const apiCollaborators = async (
  token: string,
  taskId: string,
): Promise<ReadonlyArray<{ invitationId: string; email: string; role: string; status: string }>> => {
  const res = await fetch(`${API_BASE_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      query: 'query Collaborators($taskId: ID!) { collaborators(taskId: $taskId) { invitationId email role status } }',
      variables: { taskId },
    }),
  });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as {
    data?: { collaborators?: Array<{ invitationId: string; email: string; role: string; status: string }> };
  } | null;
  return body?.data?.collaborators ?? [];
};

/** Deletes one run-owned invitation row by its exact id through the shared stack's own psql. Returns
 * the surviving row count so the caller only records verified-absent when the read-back is truly 0. */
const deleteInvitationRow = (invitationId: string): number | null => {
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return null;
  try {
    execFileSync(
      'docker',
      ['exec', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', PG_DATABASE, '-c', `DELETE FROM invitations WHERE id = '${invitationId}'`],
      { encoding: 'utf8' },
    );
    const count = execFileSync(
      'docker',
      ['exec', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', PG_DATABASE, '-tAc', `SELECT count(*) FROM invitations WHERE id = '${invitationId}'`],
      { encoding: 'utf8' },
    ).trim();
    return Number(count);
  } catch {
    return null;
  }
};

const signInAs = async (page: import('@playwright/test').Page, email: string, password: string) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForResponse(response => response.url().includes('/graphql'), { timeout: 10_000 });
  await page.waitForURL('**/tasks', { timeout: 10_000 });
};

/**
 * uat.share.invite-and-collaborate (examples/todo-app-backend/.starciwork/features/share/uat/
 * invite-and-collaborate/index.yaml):
 *   1. Sign in as the owner and create a task.
 *   2. Invite a second person as editor and a third as viewer.
 *   3. Sign in as the editor, accept the invitation, and complete the task.
 *   4. Sign in as the viewer, accept the invitation, and attempt to complete the task.
 *   5. See the viewer's attempt refused, and the task still complete.
 *   6. Sign in as the owner and revoke the editor.
 *   7. Sign in as the editor and read the task again.
 *   8. See the editor's access already gone, with no wait and no sweep in between.
 *
 * What the running product actually serves today (verified in this lane before writing a line):
 *   - The owner legs exist: /tasks/<id>/share renders ui.share.invite (invite form, viewer/editor
 *     radio, collaborator list, Revoke behind a window.confirm).
 *   - The invitee legs do NOT exist. Nothing delivers an invitation (InviteHandler publishes no
 *     event, no email is sent), no route or inbox surfaces pending invitations to the invited
 *     person, collaborators(taskId) returns [] to anyone not already bound, the tasks query is
 *     ownership-only so the shared task can never appear in the invitee's list, and no
 *     acceptInvitation call exists anywhere in src/. Steps 3-5, 7-8 are therefore recorded
 *     not-run, not faked: driving acceptInvitation/completeTask as raw GraphQL inside a browser
 *     test would counterfeit a UX the product does not have (the backend already proves those
 *     calls at API level via scripts/live-proof-share.sh).
 *   - The realm seeds exactly two accounts (demo@todo.dev, demo2@todo.dev; realm-todo.json). The
 *     record's "third person" viewer invitation is therefore sent to a run-namespaced address that
 *     exists only as a real invitation row - it is honestly pending and honestly revocable, and no
 *     account can ever sign in with it.
 *
 * The assertions below settle at partial-pass by construction: the two owner-side proofs are real,
 * the three invitee-side proofs are not-run with the missing capability named on each.
 */
test.describe(record.id, () => {
  test('walks the owner-side legs live and names the missing invitee surface', async ({ page }, testInfo) => {
    if (!LIVE_LOGIN_AUTHORIZED) {
      for (const id of record.proves) {
        recordAssertion(testInfo, {
          id,
          expected: 'yes',
          observed: 'not-run',
          note: 'Every step needs a real session on infrastructure this lane does not own; ' +
            'UAT_LIVE_LOGIN_AUTHORIZED is not true, so nothing was attempted.',
        });
      }
      return;
    }

    // The share screen's Revoke control asks window.confirm before mutating; accept it like a user would.
    page.on('dialog', dialog => void dialog.accept());

    const accounts = readAccounts(FEATURE, FLOW);
    const owner = accounts.find(a => a.role === 'owner');
    const editor = accounts.find(a => a.role === 'editor');
    const viewer = accounts.find(a => a.role === 'viewer');
    if (!owner || !editor || !viewer) throw new Error(`${FEATURE}/${FLOW}/accounts.yaml is missing an owner, editor or viewer role.`);
    const ownerPassword = passwordFor(owner.role);
    const editorPassword = passwordFor(editor.role);
    if (!ownerPassword || !editorPassword) {
      throw new Error('No credential resolved for owner/editor; set UAT_DEMO_PASSWORD and UAT_PASSWORD_EDITOR (the editor is the second seeded user).');
    }

    const title = `uat-${currentRunId()}-share`;
    const viewerInviteEmail = `uat-${currentRunId()}-viewer@todo.dev`;
    let ownerToken = '';
    let taskId = '';
    const invitedIds: Array<{ id: string; email: string }> = [];

    await walkStep(page, testInfo, 'owner-signed-in', async () => {
      await signInAs(page, owner.username, ownerPassword);
      await expect(page.locator('[data-state]').first()).toBeVisible();
      ownerToken = (await page.evaluate(() => window.localStorage.getItem('todo-app.session-token'))) ?? '';
    });

    await walkStep(page, testInfo, 'task-created', async () => {
      await page.getByLabel('New task').fill(title);
      await page.getByRole('button', { name: 'Add task' }).click();
      const row = page.locator('li', { hasText: title });
      await expect(row).toBeVisible({ timeout: 10_000 });
      recordResource(testInfo, {
        action: 'created',
        kind: 'task',
        id: title,
        note: 'Run-owned task row created through the UI, identified by its unique run-scoped title.',
      });
      // Open this task's share screen the way an owner does: the row's own Share link.
      await row.getByRole('link', { name: 'Share' }).click();
      await page.waitForURL(/\/tasks\/[^/]+\/share/, { timeout: 10_000 });
      taskId = page.url().match(/\/tasks\/([^/]+)\/share/)?.[1] ?? '';
      await expect(page.getByRole('heading', { name: 'Share this task' })).toBeVisible();
    });

    await walkStep(page, testInfo, 'editor-and-viewer-invited-pending', async () => {
      const emailField = page.getByLabel('Email address');
      await emailField.fill(editor.username);
      await page.getByRole('radio', { name: 'Editor' }).check();
      await page.getByRole('button', { name: 'Send invitation' }).click();
      const editorRow = page.locator('li', { hasText: editor.username });
      await expect(editorRow).toBeVisible({ timeout: 10_000 });
      await expect(editorRow).toContainText('Pending');

      await emailField.fill(viewerInviteEmail);
      await page.getByRole('radio', { name: 'Viewer' }).check();
      await page.getByRole('button', { name: 'Send invitation' }).click();
      const viewerRow = page.locator('li', { hasText: viewerInviteEmail });
      await expect(viewerRow).toBeVisible({ timeout: 10_000 });
      await expect(viewerRow).toContainText('Pending');

      const rows = taskId ? await apiCollaborators(ownerToken, taskId) : [];
      for (const email of [editor.username, viewerInviteEmail]) {
        // InvitationService normalizes emails to lowercase before storing; the run id carries
        // uppercase characters, so match on the normalized form.
        const invitationId = rows.find(r => r.email === email.toLowerCase())?.invitationId ?? email;
        invitedIds.push({ id: invitationId, email });
        recordResource(testInfo, {
          action: 'created',
          kind: 'invitation',
          id: invitationId,
          note: `Run-owned invitation row for ${email}, created through the owner's invite form; id read back from collaborators(taskId).`,
        });
      }
      recordAssertion(testInfo, {
        id: 'fr.share.invite',
        expected: 'yes',
        observed: 'yes',
        note: `Two invitations submitted through ui.share.invite - ${editor.username} as editor, ` +
          `${viewerInviteEmail} as viewer - both render as Pending rows in the collaborator list. ` +
          'The realm seeds only two accounts, so the "third person" viewer is a run-namespaced ' +
          'address with no login; the invitation row itself is real.',
      });
    });

    await walkStep(page, testInfo, 'editor-sign-in-finds-no-accept-surface', async () => {
      await signInAs(page, editor.username, editorPassword);
      await expect(page.locator('[data-state]').first()).toBeVisible();
      await expect(page.getByText(title)).toHaveCount(0);
      // What the invited person sees on the share route itself: collaborators(taskId) returns [] to
      // an invitee whose personId is not yet bound, so the screen renders its empty state.
      await page.goto(`/tasks/${taskId}/share`);
      await expect(page.locator('[data-state]').first()).toBeVisible();
      const missing =
        'No acceptance surface exists in the product: invite publishes no event and sends no ' +
        'email (src/modules/bussiness/share/invite.handler.ts), there is no notifications inbox, ' +
        'no route under src/app serves acceptInvitation, and no query lets an unbound invitee ' +
        'learn the invitationId - collaborators(taskId) returns [] to them (InvitationService.' +
        'listFor). The shared task can never appear in the invitee list either (tasks is ' +
        'ownership-only). This step\'s screenshots are the observed absence.';
      recordAssertion(testInfo, {
        id: 'fr.share.accept',
        expected: 'yes',
        observed: 'not-run',
        note: missing + ' Signed in as the invited editor: the run task is absent from their list ' +
          'and the share route renders an empty state with nothing to accept.',
      });
      recordAssertion(testInfo, {
        id: 'br.share.role.permissions',
        expected: 'yes',
        observed: 'not-run',
        note: 'Depends on an accepted invitation (unreachable above); even post-accept no UI ' +
          'affordance would exist, since a collaborator has no task surface to complete on.',
      });
    });

    await walkStep(page, testInfo, 'owner-revokes-both-pending-invitations', async () => {
      await signInAs(page, owner.username, ownerPassword);
      await page.goto(`/tasks/${taskId}/share`);
      await expect(page.getByRole('heading', { name: 'Share this task' })).toBeVisible();
      for (const email of [editor.username, viewerInviteEmail]) {
        const row = page.locator('li', { hasText: email });
        await row.getByRole('button', { name: 'Revoke' }).click();
        await expect(row).toContainText('Revoked', { timeout: 10_000 });
      }
      recordAssertion(testInfo, {
        id: 'fr.share.revoke',
        expected: 'yes',
        observed: 'yes',
        note: 'The owner revoked both pending invitations through the UI (Revoke + window.confirm); ' +
          'each row now reads Revoked. This proves t-revoke-pending only - the record\'s designed leg ' +
          'revokes an accepted editor, which the missing accept surface makes unreachable.',
      });
      recordAssertion(testInfo, {
        id: 'br.share.revoke.on-read',
        expected: 'yes',
        observed: 'not-run',
        note: 'Depends on an accepted collaborator whose next read is refused; no invitation could ' +
          'be accepted (missing surface above), so there is no bound access for a read to lose.',
      });
    });

    await walkStep(page, testInfo, 'task-deleted-and-invitation-rows-cleaned', async () => {
      await page.getByRole('link', { name: 'Back to task' }).click();
      await page.waitForURL('**/tasks', { timeout: 10_000 });
      const row = page.locator('li', { hasText: title });
      // Same two-step inline confirm as uat.task.create: Delete opens "Delete "<title>"?", the
      // prompt's own Delete removes the row.
      await row.getByRole('button', { name: 'Delete' }).click();
      await row.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 });
      recordResource(testInfo, {
        action: 'deleted',
        kind: 'task',
        id: title,
        note: 'Run-owned task row deleted through the UI two-step confirm.',
      });
      recordResource(testInfo, {
        action: 'verified-absent',
        kind: 'task',
        id: title,
        note: 'The title resolves to zero elements in the re-read owner list after the confirmed delete.',
      });
      for (const invitation of invitedIds) {
        const remaining = deleteInvitationRow(invitation.id);
        if (remaining === 0) {
          recordResource(testInfo, {
            action: 'deleted',
            kind: 'invitation',
            id: invitation.id,
            note: `Run-owned invitation row for ${invitation.email} deleted by exact recorded id ` +
              `(psql in ${PG_CONTAINER}); task delete does not cascade to invitations.`,
          });
          recordResource(testInfo, {
            action: 'verified-absent',
            kind: 'invitation',
            id: invitation.id,
            note: 'SELECT count(*) for the recorded id returns 0 after the delete.',
          });
        }
      }
    });
  });
});
