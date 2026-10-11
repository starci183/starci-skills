// draft-plan.mjs - the Decision Item of a seat that cannot be woken because a draft stands in its input box (scripts/kernel/draft-hold.mjs).
// ONE item for the Supervisor once the draft has stood for the seat's wake-repeat bound; a `wait` answer closes it and the next item opens after another bound;
// the mirror closes it by itself when the draft is gone (supervisor-mirror.mjs). The runtime never clears or replaces a seat that holds a draft.

const minutes = (ms) => Math.round(ms / 60_000);

/** The plan section: one Supervisor item per (episode, answered count) once the draft has stood (answered + 1) bounds. */
export function planDraftHeld(p) {
  const { draft, workflowId, now } = p;
  if (!draft) return;
  const { episode, answered, boundMs } = draft;
  const age = now - episode.since;
  if (age < boundMs * (answered + 1)) return;
  p.di({ kind: 'seat-draft-held', subject: `${episode.since}:${answered}`, decider: 'supervisor', entity: { type: 'workflow', id: workflowId },
    summary: `a draft has stood in the Kernel's input of ${workflowId} for ${minutes(age)} minutes; the seat cannot be woken (terminal ${episode.terminal ?? '?'}, ${episode.delivery ?? 'draft'}): a person typing there wins, the runtime neither clears nor replaces the seat`,
    evidence: [`draft: ${episode.draft ?? '(not readable)'}`, `${episode.refusals} refused wake(s) since ${new Date(episode.since).toISOString()}`],
    refs: { episode: episode.since, terminal: episode.terminal } });
}
