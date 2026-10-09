// tab-titles.mjs — the Supervisor seat's and its workers' Orca tab titles, restored from the runtime's names.
import { tabTitlesOf } from '../kernel/terminal-dedupe.mjs';
import { WORKER_TITLE_PREFIX, SUPERVISOR_TITLE } from '../machine/home.mjs';

/** Restore runtime names in Orca's sidebar from the tab titles, never from agent-controlled pane titles. */
function expectedSupervisorTitles(seatTerminal, workers) {
  return [
    { terminal: seatTerminal, title: SUPERVISOR_TITLE },
    ...workers.filter((job) => job.worker_id && !job.payload?.self && !job.payload?.terminalClosed)
      .map((job) => ({ terminal: job.worker_id, title: `${WORKER_TITLE_PREFIX} ${job.payload.cluster}`.slice(0, 80) })),
  ];
}

function titleNeedsRepair(terminal, title, titles, listed) {
  return terminal && titles.get(terminal) !== title && (listed.terminals ?? []).some((t) => t.handle === terminal && t.connected !== false);
}

function renameTitle(d, terminal, title) {
  try {
    const r = d.rename(terminal, title);
    return { terminal, title, ok: r?.ok === true, ...(r?.ok ? {} : { error: r?.error ?? 'terminal rename failed' }) };
  } catch (error) { return { terminal, title, ok: false, error: String(error?.message ?? error) }; }
}

export function repairSupervisorTabTitles(seatTerminal, workers, d) {
  if (!d?.list || !d?.rename) return [];
  let listed;
  try { listed = d.list(); } catch { return []; }
  if (!listed?.ok) return [];
  const titles = (d.tabTitles ?? tabTitlesOf)(listed.visualLayouts ?? [], listed.terminals ?? []);
  const repairs = [];
  for (const { terminal, title } of expectedSupervisorTitles(seatTerminal, workers)) {
    if (!titleNeedsRepair(terminal, title, titles, listed)) continue;
    repairs.push(renameTitle(d, terminal, title));
  }
  return repairs;
}
