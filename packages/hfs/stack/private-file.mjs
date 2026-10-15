// private-file.mjs - writes a file only its owner may use. On POSIX the mode is enough. Windows OpenSSH refuses a key, a known_hosts or a config
// file whose ACL still carries inherited entries ("Bad permissions ... UNKNOWN\UNKNOWN"), so on win32 the inheritance is removed with icacls and the
// current user alone is granted access. `ctx.platform` and `ctx.username` are optional seams for the specs; the defaults are the real ones.
import fs from 'node:fs';
import os from 'node:os';
import { refusal } from './errors.mjs';
import { firstLine, tool } from './context.mjs';

/** On win32: `icacls <file> /inheritance:r /grant:r <user>:<rights>` (R = read, F = full, to let a cleanup overwrite the file). Elsewhere: nothing. */
export function restrictToUser(ctx, file, rights = 'R') {
  if ((ctx.platform ?? process.platform) !== 'win32') return;
  const user = ctx.username ?? os.userInfo().username;
  const run = tool(ctx, 'icacls', [file, '/inheritance:r', '/grant:r', `${user}:${rights}`]);
  if (run.status !== 0) throw refusal('STACK_REMOTE_ACL', `cannot restrict ${file} to the current user with icacls: ${firstLine(run.stderr) || firstLine(run.stdout) || 'icacls failed'}`);
}

/** Writes `text` to `file` with owner-only access (mode on POSIX, icacls on win32). */
export function writePrivate(ctx, file, text, mode = 0o600) {
  fs.writeFileSync(file, text, { mode });
  fs.chmodSync(file, mode);
  restrictToUser(ctx, file);
}
