// scan-run.mjs — one SonarQube scanner run (scripts/gates/sonar-local.mjs scannerCommand builds the command line, with each
// argument quoted), waited for without blocking the thread: its output collected up to `logCap` characters and the run
// stopped when it exceeds `timeoutMs`. Never rejects.
import { scannerStart } from './lib.mjs';

/** Promise<{exitCode, durationMs, log}>; the log keeps the scanner's stdout and stderr in arrival order. */
export const scanRun = (line, { cwd, env, timeoutMs, logCap }) => new Promise((resolve) => {
  const started = Date.now();
  let log = '';
  let child;
  try { child = scannerStart(line, { cwd, env }); } catch (error) { resolve({ exitCode: 1, durationMs: 0, log: `[sonar-local] scanner failed to start: ${error.message}\n` }); return; }
  const take = (chunk) => { if (log.length < logCap) log += chunk.toString('utf8'); };
  child.stdout.on('data', take); child.stderr.on('data', take);
  const timer = setTimeout(() => { log += `\n[sonar-local] scanner exceeded ${Math.round(timeoutMs / 1000)}s and was stopped\n`; child.kill(); }, timeoutMs);
  child.on('error', (error) => { log += `\n[sonar-local] scanner failed to start: ${error.message}\n`; });
  child.on('close', (code) => { clearTimeout(timer); resolve({ exitCode: code ?? 1, durationMs: Date.now() - started, log }); });
});
