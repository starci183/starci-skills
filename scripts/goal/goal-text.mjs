// goal-text.mjs — a goal text that carries an unrendered value is refused before it becomes a goal.
//
// 2026-09-27 05:53 the eight restarted workflows were defined as
// "Restart on the new runtime ... Original goal:\n\nnull": the predecessor's goal was interpolated as the
// literal `null`. route-plan could not form S* (opChain null, underivable needs-owner), so every Kernel
// improvised its legs - business.decide dispatched onto integration, impl and SDS nodes it may not write
// (authority blockers), scope.define asking the owner what the goal was - and those were most of the
// decide/author failures measured since 2026-09-27T05:50Z. The text is data an approved plan is built
// from; a JS value that failed to render is never an owner's words.
//
// unresolvedPlaceholders(text) -> [{line, value}]: every line whose whole content (after an optional
// "label:" prefix) is null, undefined, NaN or [object Object].
const PLACEHOLDER = /^(?:.*:\s*)?(null|undefined|NaN|\[object Object\])\s*$/;

export function unresolvedPlaceholders(text) {
  const found = [];
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const m = PLACEHOLDER.exec(raw.trim());
    if (m) found.push({ line: i + 1, value: m[1] });
  });
  return found;
}

/** The refusal line define-goal prints, or null when the text is clean. */
export function goalTextRefusal(text) {
  const found = unresolvedPlaceholders(text);
  if (!found.length) return null;
  return `goal-text-unresolved: the goal text carries an unrendered value (${found.map((f) => `line ${f.line}: ${f.value}`).join('; ')}) - `
    + 'a restart or carried goal must embed the predecessor goal\'s own markdown (goals.markdown of its newest revision), never a missing field';
}
