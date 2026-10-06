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

/**
 * The report tail of a check's own main(): `run()` under the check's input-error guard (`command: <message>` is a
 * usage refusal, anything else rethrows), `--json` prints the envelope, otherwise `render(report)` gives the text.
 */
export const checkReportResult = (json, inputError, command, run, render) => {
  let report;
  try { report = run(); } catch (error) {
    if (error instanceof inputError) return { exitCode: 2, text: `${command}: ${error.message}\n` };
    throw error;
  }
  if (json) return { exitCode: report.ok ? 0 : 1, text: `${JSON.stringify(report, null, 2)}\n` };
  return render(report);
};
