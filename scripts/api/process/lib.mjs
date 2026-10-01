// scripts/api/process/lib.mjs — what the process call files beside it share: the spawn options every child of the
// runtime carries. The call files (process-list.mjs, kill-tree.mjs, run-shell.mjs, spawn-detached.mjs, set-priority.mjs,
// hide-child-windows.mjs, ...) each name one use of the host's process table or a child process.

/**
 * `list` with windowsHide: true added to its options argument. `hasArgv`:
 * the call's second argument may be an argv array (spawn, execFile) rather
 * than options (exec). An explicit windowsHide (true or false) is kept.
 */
export function withWindowsHide(list, hasArgv) {
  const out = [...list];
  let slot = 1;
  if (hasArgv && (Array.isArray(out[1]) || (out[1] == null && out.length > 2))) slot = 2;
  const options = out[slot];
  if (options == null) out.splice(slot, out.length > slot ? 1 : 0, { windowsHide: true });
  else if (typeof options === 'function') out.splice(slot, 0, { windowsHide: true });
  else if (typeof options === 'object' && !('windowsHide' in options)) out[slot] = { ...options, windowsHide: true };
  return out;
}
