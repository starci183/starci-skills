// One-off probe: does a command that covers fr.checkout.place-order's rev-2 `unknown-product`
// exception flow actually match and pass? Prints jest's summary lines so a vacuous -t match is visible.
const cp = require('child_process');
const cwd = 'D:\\Repositories\\starci-academy-backend\\.claude\\examples\\ecommerce-app-be';
for (const cmd of process.argv.slice(2)) {
  const run = cp.spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const out = (run.stdout || '') + '\n' + (run.stderr || '');
  const lines = out.split(/\r?\n/).filter((l) => /^(PASS|FAIL|Tests:|Test Suites:)/.test(l.trim())).map((l) => l.trim());
  console.log(`$ ${cmd}\n  exit=${run.status}`);
  lines.forEach((l) => console.log('   ' + l));
}
