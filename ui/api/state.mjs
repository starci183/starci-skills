const UI_STATES = new Set(['bad', 'warn', 'running', 'waiting', 'ok', 'done', 'unknown']);

export function uiState(db, entity, native, { dueAt = null, now = Date.now(), warnAt = null, escalations = 0 } = {}) {
  const mapped = db?.prepare('SELECT ui FROM ui_state_map WHERE entity=? AND native=?').get(entity, native)?.ui ?? 'unknown';
  if (!UI_STATES.has(mapped)) return 'unknown';
  if (mapped !== 'waiting' && mapped !== 'warn') return mapped;
  if (dueAt != null && now > dueAt) return 'bad';
  if (escalations >= 2) return 'bad';
  if ((warnAt != null && now >= warnAt) || escalations > 0) return mapped === 'waiting' ? 'warn' : mapped;
  return mapped;
}

export function viewState(row) { return UI_STATES.has(row?.ui) ? row.ui : 'unknown'; }
