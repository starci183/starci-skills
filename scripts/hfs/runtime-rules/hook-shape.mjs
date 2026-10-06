// hook-shape.mjs - RT_HOOK_SHAPE (knowledge/hfs/rules.yaml, gate runtime): the app hook templates keep the gate model.
//   pre-commit  L0 only: no typecheck and no test run (`test:` scripts, npm test, jest, vitest, a spec). Types and the targeted specs
//               belong to the op gate.
//   pre-push    a release gate check, never a build or test run: no npm test, jest, vitest, typecheck or lint, and it carries the
//               release gate markers: `starci-release` (the L4 record directory), `refs/backup/` (the backup namespace) and `v[0-9]`
//               (the release tag pattern). A push of anything but the release cut and refs/backup/* is refused there.
// Comments are not judged (the templates explain what they do not run). Pure apart from ctx.read.
export const CODE = 'RT_HOOK_SHAPE';
export const TEMPLATE_DIR = 'packages/hfs/templates/app/hooks/husky';
const PRE_COMMIT = `${TEMPLATE_DIR}/pre-commit`;
const PRE_PUSH = `${TEMPLATE_DIR}/pre-push`;

const PRE_COMMIT_FORBIDDEN = [
  [/\btypecheck\b/, 'a typecheck'],
  [/\btest:|\bnpm\s+(?:run\s+)?test\b|\bjest\b|\bvitest\b|\bspecs?\b/, 'a test run'],
];
const PRE_PUSH_FORBIDDEN = [
  [/\bnpm\s+(?:run\s+)?test\b|\btest:|\bjest\b|\bvitest\b/, 'a test run'],
  [/\btypecheck\b/, 'a typecheck'],
  [/\blint\b/, 'a lint run'],
];
const PRE_PUSH_MARKERS = ['starci-release', 'refs/backup/', 'v[0-9]', 'RIGHTS_PUSH_NOT_RELEASE'];

const code = (text) => text.split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join('\n');
const finding = (file, message) => ({ code: CODE, level: 'error', path: file, message: `${CODE} ${file}: ${message}` });

/** The RT_HOOK_SHAPE findings of one hook template: `name` is 'pre-commit' or 'pre-push', `text` its content. */
export function fileHookShapeFindings({ path: file, name, text }) {
  const body = code(text);
  const found = [];
  const forbidden = name === 'pre-commit' ? PRE_COMMIT_FORBIDDEN : PRE_PUSH_FORBIDDEN;
  for (const [pattern, what] of forbidden) {
    if (pattern.test(body)) found.push(finding(file, name === 'pre-commit' ? `the commit gate is L0 only and runs ${what}; types and targeted specs belong to the op gate` : `the push gate checks the release gate and runs ${what}; only the release cut tests`));
  }
  if (name === 'pre-push') {
    const missing = PRE_PUSH_MARKERS.filter((marker) => !body.includes(marker));
    if (missing.length) {
      const markers = missing.map((m) => `\`${m}\``).join(', ');
      found.push(finding(file, `the push gate lacks the release gate marker${missing.length === 1 ? '' : 's'} ${markers}; it must check the L4 record of HEAD and allow only the release cut and refs/backup/*`));
    }
  }
  return found;
}

/** RT_HOOK_SHAPE over the app hook templates (ctx of scripts/hfs/runtime-check.mjs). */
export function hookShapeFindings(ctx) {
  return [['pre-commit', PRE_COMMIT], ['pre-push', PRE_PUSH]].flatMap(([name, file]) => {
    if (!ctx.fileSet.has(file)) return [];
    const text = ctx.read(file);
    return text === null || text === undefined ? [] : fileHookShapeFindings({ path: file, name, text });
  });
}
