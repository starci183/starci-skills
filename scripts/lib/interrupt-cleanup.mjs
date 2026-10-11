// interrupt-cleanup.mjs - the one owner of "what a long verb leaves behind when it is interrupted". A verb that creates something outside its own return path (a lock, a temp file,
// a container) registers the undo with `onInterrupt(undo)`; the undo runs when the process receives SIGINT, SIGTERM, SIGBREAK or SIGHUP (then the process exits with 128 + the signal number)
// and when the process exits while the registration is still open, and never twice. The returned disposer removes the registration once the verb released the thing itself.
// The process handlers are installed with the first registration and removed with the last. The registry takes the process as a seam (`proc`: on, off, exit).
const SIGNALS = Object.freeze({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15, SIGBREAK: 21 });

/** A registry of undo functions bound to `proc`. */
export function createInterruptRegistry({ proc = process } = {}) {
  const undos = new Set();
  const handlers = new Map();

  const runAll = () => {
    for (const undo of [...undos].reverse()) {
      undos.delete(undo);
      try { undo(); } catch { /* one failing undo never stops the others */ }
    }
  };
  const uninstall = () => {
    for (const [event, handler] of handlers) proc.off(event, handler);
    handlers.clear();
  };
  const install = () => {
    if (handlers.size) return;
    for (const [signal, number] of Object.entries(SIGNALS)) handlers.set(signal, () => { runAll(); uninstall(); proc.exit(128 + number); });
    handlers.set('exit', runAll);
    for (const [event, handler] of handlers) proc.on(event, handler);
  };

  /** Register `undo`; returns the disposer that removes it (and the process handlers when it was the last). */
  const onInterrupt = (undo) => {
    undos.add(undo);
    install();
    return () => { undos.delete(undo); if (!undos.size) uninstall(); };
  };
  return { onInterrupt, pending: () => undos.size };
}

export const { onInterrupt } = createInterruptRegistry();
