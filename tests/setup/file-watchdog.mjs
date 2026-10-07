// file-watchdog.mjs - the node --test preload that bounds one spec file's wall clock.
//
// `node --test` runs each spec file in its own child process. A spec that leaks a live child (a manager with a
// setInterval, a server) keeps that process alive on its stdio pipes after every test is over, and --test-timeout
// does not help: it fails the test that ran past it but never ends the file's process, so one hung spec stalls the
// whole suite for as long as the leak lives (a 110-minute stall on connectors-single-instance). This timer is
// unref'd, so it never keeps a healthy process up; when a file is still running after the limit it names the
// file on stderr and exits nonzero, which fails that file and lets the run go on.
//
// The limit is generous: the slowest legitimate files (supervisor-kernel, hfs-scaffold-app.e2e) take 2 to 9
// minutes under load. STARCI_SPEC_FILE_TIMEOUT_MS overrides it. Only a runner's child process arms it
// (NODE_TEST_CONTEXT is set there), never the runner itself, whose run is the whole suite.
export const SPEC_FILE_TIMEOUT_MS = 30 * 60 * 1000;

export function armWatchdog(env = process.env, label = process.argv[1] ?? 'a spec file') {
  if (!env.NODE_TEST_CONTEXT) return null;
  const ms = Number(env.STARCI_SPEC_FILE_TIMEOUT_MS) > 0 ? Number(env.STARCI_SPEC_FILE_TIMEOUT_MS) : SPEC_FILE_TIMEOUT_MS;
  const timer = setTimeout(() => {
    process.stderr.write(`spec file watchdog: ${label} still running after ${Math.round(ms / 1000)}s; a test leaked a live process or never settled. Exiting so the run can continue.\n`);
    process.exit(1);
  }, ms);
  timer.unref();
  return timer;
}

armWatchdog();
