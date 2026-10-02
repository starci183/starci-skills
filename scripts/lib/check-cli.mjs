// check-cli.mjs - the one CLI tail of a check script: `--json` prints the findings envelope, otherwise each finding goes
// to stderr and a green run prints its OK line; the exit code is the finding count's sign.
export function runCheckCli(findings, okText) {
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.path}:${f.line} ${f.message}`);
    if (!findings.length) console.log(okText);
  }
  process.exit(findings.length ? 1 : 0);
}
