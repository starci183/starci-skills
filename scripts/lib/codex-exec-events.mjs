// codex-exec-events.mjs — the `codex exec --json` event stream read line by line: the thread the run opened (its generated
// images are kept under that id), the token usage of its turn, and the failures it reported. Pure.

const QUOTA = /usage limit|rate.?limit|quota|too many requests|\b429\b|exceeded your|insufficient credit/i;
const AUTH = /not logged in|log ?in|unauthori[sz]ed|\b401\b|sign in|authentication|invalid (?:api )?key/i;

/** A fresh reading state. */
export const newExecEvents = () => ({ threadId: null, usage: null, failures: [], lastMessage: null });

function failureText(event) {
  if (event.type === 'error') return String(event.message ?? '');
  if (event.type === 'turn.failed') return String(event.error?.message ?? '');
  return '';
}

/** Fold one stdout line into `state` (a line that is not a JSON event is ignored) and return the state. */
export function takeExecLine(state, line) {
  let event = null;
  try { event = JSON.parse(line); } catch { return state; }
  if (!event || typeof event !== 'object') return state;
  if (event.type === 'thread.started' && typeof event.thread_id === 'string') state.threadId = event.thread_id;
  if (event.type === 'turn.completed' && event.usage) state.usage = event.usage;
  if (event.type === 'item.completed' && event.item?.type === 'agent_message') state.lastMessage = String(event.item.text ?? '');
  const failure = failureText(event);
  if (failure) state.failures.push(failure);
  return state;
}

/** The class of a failure text: `quota` (a usage or rate limit), `auth` (no usable login), else `runner`. */
export function failureClass(text) {
  if (QUOTA.test(text)) return 'quota';
  if (AUTH.test(text)) return 'auth';
  return 'runner';
}
