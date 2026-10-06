// app-data.mjs — the per-OS application-data base directory (the parent of 'orca', 'codex-runtime-home'
// and friends): %APPDATA% on Windows, ~/Library/Application Support on macOS, $XDG_CONFIG_HOME|~/.config elsewhere.
import os from 'node:os';
import path from 'node:path';

/** The application-data base directory of this platform: {env, platform, home}: the caller passes the environment. */
export const appDataBase = ({ env, platform = process.platform, home = os.homedir() } = {}) => {
  if (platform === 'win32') return env.APPDATA || path.join(home, 'AppData', 'Roaming');
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support');
  return env.XDG_CONFIG_HOME || path.join(home, '.config');
};
