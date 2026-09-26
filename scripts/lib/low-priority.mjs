import os from 'node:os';

/**
 * Drop this process to below-normal CPU priority. On Windows a child process inherits a below-normal
 * priority class, so every spec, build and browser the caller spawns yields to the owner's desktop.
 * A platform that refuses the call keeps running at its current priority.
 */
export function lowerOwnPriority() {
  try {
    os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
    return true;
  } catch {
    return false;
  }
}
