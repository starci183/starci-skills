// guard-launcher.mjs — the per-user launcher a spec's trust home needs: launch trust runs the guard hook command it
// registers (scripts/api/process/probe-guard-command.mjs), and the command names <home>/.starci/bin/starci.
import path from 'node:path';
import { writeRuntimeShim } from '../../packages/cli/src/shim.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

/** Write the POSIX and cmd launchers of this checkout under `home` (a temp trust home); returns the writer's result. */
export const installGuardLauncher = (home) => writeRuntimeShim({ root: ROOT, home });
