// guard-command.mjs — the one spelling of the hook command that registers a StarCi guard verb with an agent host.
//
// A host runs a hook command through a shell the runtime does not choose: Claude Code runs it through bash (Git Bash on
// Windows), others through the platform shell (cmd on Windows). The seat's PATH is not guaranteed to hold the
// per-user launcher directory, so the command names the launcher by absolute path, double-quoted, with forward slashes:
// bash runs the extensionless POSIX launcher, cmd finds `starci.cmd` beside it through PATHEXT, and sh runs the same
// launcher on POSIX. `starci runtime install` and `runtime link` write both launchers (packages/cli/src/shim.mjs).
import os from 'node:os';

/** The home a tracked file spells instead of a machine path: the shell that runs the hook expands it. */
export const PORTABLE_HOME = '$HOME';

const GUARD_COMMAND_END = /starci"? guard command$/;

/** The hook command of `starci guard <verb>`: the quoted launcher path under `home`, then the verb. */
export const guardHookCommand = (verb, { home = os.homedir() } = {}) => `"${String(home).replaceAll('\\', '/')}/.starci/bin/starci" guard ${verb}`;

/** The hook command every host registers for the command guard. */
export const toolGuardCommand = (options = {}) => guardHookCommand('command', options);

/** Whether `command` registers the command guard: the current spelling or the bare `starci guard command` a rewrite replaces. */
export const isGuardCommand = (command) => GUARD_COMMAND_END.test(String(command ?? ''));
