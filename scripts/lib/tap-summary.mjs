// tap-summary.mjs - the summary of a node:test TAP report: the `# tests/pass/fail/cancelled/skipped/todo` block and the names of
// the failing tests (a nested test's path is rebuilt from the enclosing subtests; a parent whose child fails is not listed).
// Pure text in, numbers out.

const COUNTS = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];

/** {tests, pass, fail, cancelled, skipped, todo} as numbers (null when the report has no such line), and `failing` names. */
export function tapSummary(tap) {
  const text = String(tap ?? '');
  const out = Object.fromEntries(COUNTS.map((key) => {
    const m = new RegExp(String.raw`^# ${key} (\d+)\s*$`, 'm').exec(text);
    return [key, m ? Number(m[1]) : null];
  }));
  const stack = [];
  const failing = [];
  for (const raw of text.split(/\r?\n/)) {
    const sub = /^(\s*)# Subtest: (.*)$/.exec(raw);
    if (sub) { const depth = sub[1].length / 4; stack.length = depth; stack[depth] = sub[2]; continue; }
    const bad = /^(\s*)not ok \d+ - (.*?)(\s+#\s*(TODO|SKIP)\b.*)?$/i.exec(raw);
    if (bad && !bad[3]) failing.push([...stack.slice(0, bad[1].length / 4), bad[2]].join(' > '));
  }
  out.failing = failing.filter((name) => !failing.some((other) => other !== name && other.startsWith(`${name} > `)));
  return out;
}
