import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATES_DIR } from '../sync/index.mjs';
import { ScaffoldError } from './service.mjs';

/** Adds `importLine` and one `symbol` entry of the `imports` array of a module file's lines, once. */
export function addModuleImport(lines, { importLine, entry, relative, noun }) {
  const active = compositionCode(lines.join('\n')).split('\n');
  const imported = active.some(line => line.replace(/;\s*$/, '') === importLine);
  const registered = active.some(line => line.trim() === `${entry},` ||
    (/\bimports:\s*\[/.test(line) && !line.trim().startsWith('//') && line.replace(/\s+/g, '').includes(entry.replace(/\s+/g, ''))));
  const lastImport = active.reduce((last, line, index) => line.startsWith('import ') ? index : last, -1);
  const importsLine = line => /\bimports:\s*\[/.test(line) && !line.trim().startsWith('//');
  if (lastImport < 0 || active.findIndex(importsLine) < 0) throw new ScaffoldError('HFS_ADD_WIRE_INVALID', `add ${noun} could not find the imports array in ${relative}`);
  if (imported && registered) return;
  if (!imported) lines.splice(lastImport + 1, 0, importLine);
  if (registered) return;
  const imports = compositionCode(lines.join('\n')).split('\n').findIndex(importsLine);
  const indent = /^(\s*)/.exec(lines[imports])?.[1] ?? '';
  if (/^\s*imports: \[$/.test(lines[imports])) lines.splice(imports + 1, 0, `${indent}    ${entry},`);
  else lines[imports] = lines[imports].replace(/(\bimports:\s*\[)\s*/, `$1${entry}, `);
}

/** Masks comments without changing offsets or treating quoted module specifiers as comments. */
export function compositionCode(text) {
  return text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    value => value.startsWith('/') ? value.replace(/[^\r\n]/g, ' ') : value);
}


/** Reads the explicitly typed expression body of a group without treating comments as active declarations. */
export function readComposeGroup({ repoRoot, repo, app, area, noun }) {
  const relative = `be/apps/${app}/src/compose/${area}.ts`;
  const file = path.join(repoRoot, ...relative.split('/'));
  const exists = fs.existsSync(file);
  const skeleton = repo.edition === 'lite' ? 'skeleton-lite/apps/api' : 'skeleton/apps/__app__';
  const template = path.join(TEMPLATES_DIR, 'be', ...skeleton.split('/'), 'src', 'compose', `${area}.ts`);
  const text = fs.readFileSync(exists ? file : template, 'utf8').replace(/\r\n/g, '\n');
  const argument = area === 'domain' && repo.edition === 'lite' ? 'verifyAccessToken: VerifySupabaseAccessToken' : '';
  const marker = `export const ${area}Modules = (${argument}): Array<Type<unknown> | DynamicModule> => [`;
  const declarationAt = compositionCode(text).indexOf(`\n${marker}`);
  const active = declarationAt >= 0;
  const tail = active ? text.slice(declarationAt + 1 + marker.length).trimEnd().replace(/;$/, '').trimEnd() : '';
  const body = tail.endsWith(']') ? tail.slice(0, -1) : undefined;
  if (body === undefined) throw new ScaffoldError('HFS_ADD_WIRE_INVALID', `add ${noun} needs the typed ${area}Modules group in ${relative}`);
  return { relative, file, exists, text, marker, body };
}

/** Creates a typed group from the edition's template, or adds members without duplicating inline registrations or semicolon imports. */
export function planComposeGroup(input) {
  const { relative, file, exists, marker, body, text: original } = readComposeGroup(input);
  let text = original;
  let compactBody = compositionCode(body).replace(/\s+/g, '');
  for (const { importLine, entry } of input.entries) {
    const lines = text.split('\n');
    if (!lines.some(line => line.replace(/;\s*$/, '') === importLine)) {
      const lastImport = lines.reduce((last, line, index) => line.startsWith('import ') ? index : last, -1);
      lines.splice(lastImport + 1, 0, importLine);
      text = lines.join('\n');
    }
    const compactEntry = entry.replace(/\s+/g, '');
    const members = `,${compactBody},`;
    if (!members.includes(`,${compactEntry},`)) {
      const afterMarker = compositionCode(text).indexOf(marker) + marker.length;
      const empty = text.slice(afterMarker).startsWith(']');
      text = `${text.slice(0, afterMarker)}\n    ${entry},${empty ? '\n' : ''}${text.slice(afterMarker)}`;
      compactBody = `${compactEntry},${compactBody}`;
    }
  }
  return { relative, file, exists, text };
}

/** Writes the planned group and reports a newly created composition file. */
export function writeComposeGroup(input) {
  const { relative, file, exists, text } = planComposeGroup(input);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return exists ? [] : [relative];
}
