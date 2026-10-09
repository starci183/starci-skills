// release-ci-item.mjs - the `starci reconciler up --check` row for the last release's CI verdict (scripts/supervisor/release-ci-status.mjs): green when the ci workflow of the newest release was green,
// warn (never required: the host is fine, the release is not) when it was red, still running or never read. A release cut under `suite: ci` is judged only there, so a red row is the reminder
// that the suite has not passed; the defect record for Debug is made by `starci release ci-status`, which this row never writes.
import { green, warn } from './checklist-items.mjs';
import { ciLine, latestCiRecord } from '../supervisor/release-ci-status.mjs';

/** The checklist rows for the last release CI of the runtime repository at `repo`: [] when no release was cut in this checkout. `latest` is the seam for specs. */
export function releaseCiItems({ repo, latest = latestCiRecord } = {}) {
  let record;
  try { record = latest({ repo }); } catch { return []; }
  if (!record) return [];
  const detail = `last release CI: ${ciLine(record)}`;
  if (record.state === 'green') return [green('preflight', 'release-ci', 'last release CI', detail, { required: false })];
  const command = `starci release ci-status --tag ${record.tag} --wait`;
  const fix = record.state === 'red' ? `${command} (a red run is fixed forward with the next pre-release)` : command;
  return [warn('preflight', 'release-ci', 'last release CI', detail, fix)];
}
