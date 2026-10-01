// set-priority.mjs — this process's own CPU priority (os.setPriority).
import os from 'node:os';

/**
 * Set this process's CPU priority, below-normal unless `priority` says otherwise. On Windows a child process inherits a
 * below-normal priority class, so every spec, build and browser the caller spawns yields to the owner's desktop. A
 * platform that refuses the call keeps running at its current priority. True when the priority was set.
 */
export function setPriority(priority = os.constants.priority.PRIORITY_BELOW_NORMAL) {
  try {
    os.setPriority(priority);
    return true;
  } catch {
    return false;
  }
}
