// Materialise a knowledge/repository-baseline.yaml profile into a directory exactly as
// BASELINE-ONE-SOURCE tells a scaffold to: the manifest composed in common.manifest.order,
// every files entry written byte for byte with only its placeholders filled.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const BASELINE = 'knowledge/repository-baseline.yaml';
export const readBaseline = () => parseYaml(fs.readFileSync(path.join(ROOT, BASELINE), 'utf8'));

const at = (node, dotted) => dotted.split('.').reduce((value, part) => value?.[part], node);

// TypeScript type arguments share the angle-bracket form; a placeholder is lowercase-initial and not a type keyword.
const TYPE_KEYWORDS = new Set(['any', 'bigint', 'boolean', 'never', 'null', 'number', 'object', 'string', 'symbol', 'undefined', 'unknown', 'void']);
export const isTypeArgument = key => /^[A-Z]/.test(key) || TYPE_KEYWORDS.has(key);
export const placeholdersIn = text => [...new Set([...String(text).matchAll(/<([a-zA-Z][\w.]*)>/g)].map(match => match[1]).filter(key => !isTypeArgument(key)))];

/** Fill <placeholder> from the declared parameters first, then the scalar it names in common. */
export function filler(doc, parameters) {
  const common = doc.shapes.find(shape => shape.id === 'common');
  return text => String(text).replace(/<([a-zA-Z][\w.]*)>/g, (whole, key) => {
    if (isTypeArgument(key)) return whole;
    if (Object.hasOwn(doc.parameters, key)) {
      if (!Object.hasOwn(parameters, key)) throw Error(`parameter <${key}> has no value`);
      return parameters[key];
    }
    const value = at(common, key);
    if (value === undefined || typeof value === 'object') throw Error(`<${key}> does not name a common scalar`);
    return String(value);
  });
}

// A value another runtime file owns is cited as <file>#<dotted.path>; the canon pin lives in code-patterns.yaml.
export const CITATION = /^(modules\/models\/code-patterns\.yaml)#([\w.-]+)$/;
export function resolveCitation(value) {
  const [, file, dotted] = CITATION.exec(value);
  const resolved = at(parseYaml(fs.readFileSync(path.join(ROOT, file), 'utf8')), dotted);
  if (resolved === undefined || typeof resolved === 'object') throw Error(`${value} does not cite a scalar`);
  return String(resolved);
}

const deepFill = (value, fill, common) => {
  if (typeof value === 'string' && CITATION.test(value)) return resolveCitation(value);
  if (typeof value === 'string') return /^common\.[\w.]+$/.test(value) ? deepFill(at(common, value.slice('common.'.length)), fill, common) : fill(value);
  if (Array.isArray(value)) return value.map(item => deepFill(item, fill, common));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [fill(key), deepFill(item, fill, common)]));
  return value;
};

/** The manifest, hook files and every files entry for one profile, placeholders filled. */
export function composeProfile(profile, parameters, doc = readBaseline()) {
  const shapes = Object.fromEntries(doc.shapes.map(shape => [shape.id, shape]));
  const { common } = shapes, shape = shapes[profile];
  if (!shape) throw Error(`no baseline shape ${profile}`);
  const fill = filler(doc, parameters), resolve = value => deepFill(value, fill, common);
  const sources = {
    name: common.manifest.name, version: common.manifest.version, private: common.manifest.private,
    packageManager: common.packageManager, engines: common.engines,
    scripts: { ...common.scripts, ...shape.scripts }, 'lint-staged': common.manifest['lint-staged'], starci: shape.starci,
    dependencies: { ...shape.dependencies }, devDependencies: { ...common.devDependencies, ...shape.devDependencies },
  };
  const manifest = Object.fromEntries(common.manifest.order.map(key => [key, resolve(sources[key])]));
  const files = { [common.manifest.file]: `${JSON.stringify(manifest, null, 2)}\n` };
  for (const [file, source] of Object.entries(common.hooks.files)) files[file] = `${resolve(source)}\n`;
  files['.gitignore'] = `${[...common.gitignore, ...(shape.gitignore ?? [])].join('\n')}\n`;
  for (const [file, content] of Object.entries(shape.files)) files[fill(file)] = fill(content);
  return files;
}

export function writeProfile(directory, profile, parameters, doc) {
  const files = composeProfile(profile, parameters, doc);
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return Object.keys(files).sort();
}

export const SAMPLE_PARAMETERS = { name: 'baseline-probe', app: 'core', grammarFamily: 'core' };
