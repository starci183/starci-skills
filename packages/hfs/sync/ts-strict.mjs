// HFS_TS_STRICT (R22): a repository's root tsconfig.json extends the canon preset (be.json for a back end, next.json for a
// front end), adds `paths` when the template has them and the template's `exclude` (the e2e tree, which its own tsconfig checks),
// and nothing else. Every strict flag lives in @starci/tsconfig; a repository that sets, lowers or adds any compiler option, or changes the program with
// include/exclude/files/references, has left the preset. The expected shape is read from the rendered
// template (templates/<profile>/tool-config/tsconfig.json), so the preset name and the aliases exist in one place only.
export const TS_STRICT_FILE = 'tsconfig.json';

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const describe = (value) => (value === undefined ? 'unset' : JSON.stringify(value));

/**
 * The HFS_TS_STRICT findings of one tsconfig.json text against the rendered one: [{ code, level, path, flag, message }].
 * `flag` names the offending key (`extends`, `paths`, a compiler option, or a top-level key).
 */
export function tsStrictFindings(actualText, expectedText, file = TS_STRICT_FILE) {
  const expected = JSON.parse(expectedText);
  const finding = (flag, message) => ({ code: 'HFS_TS_STRICT', level: 'error', path: file, flag, message: `${file}: ${message}` });
  let actual;
  try {
    actual = JSON.parse(actualText);
  } catch (error) {
    return [finding('parse', `is not valid JSON (${String(error.message).split('\n')[0]}); it must be the rendered file, which extends ${expected.extends}`)];
  }
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return [finding('parse', `is not a JSON object; it must extend ${expected.extends}`)];
  const findings = [];
  if (actual.extends !== expected.extends) findings.push(finding('extends', `extends ${describe(actual.extends)}, but the only preset is ${expected.extends}`));
  for (const key of Object.keys(actual)) {
    if (key === 'extends' || key === 'compilerOptions') continue;
    if (key in expected && same(actual[key], expected[key])) continue;
    findings.push(finding(key, key in expected ? `${key} must be ${describe(expected[key])}, found ${describe(actual[key])}` : `sets ${key}: the program is the template's, narrowed by nothing else`));
  }
  for (const key of Object.keys(expected)) {
    if (key !== 'extends' && key !== 'compilerOptions' && !(key in actual)) findings.push(finding(key, `${key} is missing; it must be ${describe(expected[key])}`));
  }
  const options = actual.compilerOptions && typeof actual.compilerOptions === 'object' && !Array.isArray(actual.compilerOptions) ? actual.compilerOptions : {};
  for (const [flag, value] of Object.entries(options)) {
    if (flag === 'paths') continue;
    findings.push(finding(flag, `${value === false ? 'lowers' : 'sets'} ${flag} (${describe(value)}); every compiler option comes from the preset`));
  }
  const aliases = expected.compilerOptions?.paths ?? {};
  for (const alias of Object.keys(aliases)) {
    if (!same(options.paths?.[alias], aliases[alias])) findings.push(finding('paths', `paths must map ${alias} to ${describe(aliases[alias])}, found ${describe(options.paths?.[alias])}`));
  }
  for (const alias of Object.keys(options.paths ?? {})) {
    if (!(alias in aliases)) findings.push(finding('paths', `paths adds the alias ${alias}; the aliases of the template are the only ones`));
  }
  return findings;
}
