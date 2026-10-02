// hfs add <noun> <name> - generates exactly one kind's file tree FROM the pattern knowledge files.
//
// The `files:` tree of a pattern topic (knowledge/patterns/be/<topic>.yaml) is the single source of what the pattern places: its paths, the
// slot that owns each, the rules that judge it, and the one content body (`template`, a file under templates/be/patterns/) of each. This
// module reads the tree of the noun's topic (`ruleParams.be.addKinds` names it), fills the path variables, writes each instance file that
// does not exist, adds the platform capabilities the noun's patterns need when they are missing, and registers the patterns and the trigger
// kind in hfs.json (`sides.be.patterns`, `sides.be.kinds`). There is no second list of files and no second copy of a body: a kind is only
// generated when it is used, so an empty kind folder never exists.
//
//   hfs add job send-receipt                      features/jobs/send-receipt: module, processor, one step; the platform jobs and queue capabilities
//   hfs add reactor payment-status --event payment-settled --from payment --service PaymentStatusService=@modules/domain/order
//   hfs add queue receipt                          modules/queues/receipt: the typed producer
//   hfs add projection order-summary --connection order
//
// Body placeholders: for each variable `v` of the tree (job, step, event, ...) `@@v@@` is its kebab name, `@@V@@` its PascalCase and
// `@@vCamel@@` its camelCase, `@@vUpper@@` its UPPER_SNAKE and `@@vSnake@@` its snake_case; the option `--service Class=module` gives `@@service@@` (the class) and `@@serviceModule@@`.
import fs from 'node:fs';
import path from 'node:path';
import { createSlotResolver, loadSlotManifest, readRepoDeclaration, ruleParams } from '../runtime/scripts/hfs/slots.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { TEMPLATES_DIR } from '../sync/index.mjs';
import { ScaffoldError, pascalOf } from './service.mjs';
import { refuseInEdition } from './edition-gate.mjs';

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VARIABLE = /<([A-Za-z][A-Za-z0-9]*)>/g;
const PLACEHOLDER = /@@([A-Za-z][A-Za-z0-9]*)@@/g;
const PLATFORM_PREFIX = 'src/modules/platform/';
const TOPICS_DIR = path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'patterns', 'be');
const PATTERN_TEMPLATES = path.join(TEMPLATES_DIR, 'be', 'patterns');

const camelOf = (name) => { const pascal = pascalOf(name); return pascal[0].toLowerCase() + pascal.slice(1); };

/** The `files:` tree of the topic `topic`, read from the knowledge file the package carries. */
function readTree(topic) {
  const file = path.join(TOPICS_DIR, `${topic}.yaml`);
  if (!fs.existsSync(file)) throw new ScaffoldError('HFS_ADD_TOPIC_MISSING', `the pattern topic ${topic} (knowledge/patterns/be/${topic}.yaml) is not carried by this package`);
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(doc?.files)) throw new ScaffoldError('HFS_ADD_TREE_MISSING', `knowledge/patterns/be/${topic}.yaml has no files tree`);
  return doc.files;
}

/** Fills the `<name>` variables of a path; returns null when a variable has no value. */
const fillPath = (text, values) => {
  let missing = false;
  const filled = text.replace(VARIABLE, (whole, name) => (values[name] === undefined ? ((missing = true), whole) : values[name]));
  return missing ? null : filled;
};

/** The body of a template with its placeholders filled; an unknown placeholder is a refusal. */
const renderBody = (text, values, forms, template) => text.replace(PLACEHOLDER, (whole, name) => {
  if (forms[name] === undefined) throw new ScaffoldError('HFS_ADD_PLACEHOLDER_UNKNOWN', `template ${template} uses ${whole}, which no variable of this noun provides`);
  return forms[name];
});

/** The spellings of every variable: kebab (`job`), Pascal (`Job`), camel (`jobCamel`), UPPER_SNAKE (`jobUpper`) and snake_case (`jobSnake`). */
function formsOf(values) {
  const forms = {};
  for (const [name, value] of Object.entries(values)) {
    const kebab = KEBAB.test(value);
    forms[name] = value;
    forms[name[0].toUpperCase() + name.slice(1)] = kebab ? pascalOf(value) : value[0].toUpperCase() + value.slice(1);
    forms[`${name}Camel`] = kebab ? camelOf(value) : value[0].toLowerCase() + value.slice(1);
    forms[`${name}Upper`] = kebab ? value.replaceAll('-', '_').toUpperCase() : value;
    forms[`${name}Snake`] = kebab ? value.replaceAll('-', '_') : value;
  }
  return forms;
}

/** The variables of the noun: the instance name, the options it needs and the defaults of the others. */
function variablesOf({ spec, noun, name, options }) {
  if (!KEBAB.test(name)) throw new ScaffoldError('HFS_ADD_NAME_INVALID', `${noun} name ${name} must be kebab-case (letters, digits and single dashes)`);
  const values = { [spec.variable]: name };
  for (const need of spec.needs ?? []) {
    const value = options[need];
    if (typeof value !== 'string' || !value) throw new ScaffoldError('HFS_ADD_OPTION_MISSING', `hfs add ${noun} needs --${need}`);
    if (need === 'service') {
      const [className, module] = value.split('=');
      if (!className || !module) throw new ScaffoldError('HFS_ADD_OPTION_INVALID', '--service takes <ServiceClass>=<module specifier>');
      values.service = className;
      values.serviceModule = module;
    } else {
      if (!KEBAB.test(value)) throw new ScaffoldError('HFS_ADD_OPTION_INVALID', `--${need} ${value} must be kebab-case`);
      values[need] = value;
    }
  }
  for (const [key, rule] of Object.entries(spec.defaults ?? {})) if (values[key] === undefined) values[key] = rule === '@name' ? name : String(rule);
  return values;
}

/**
 * Generates the tree of one noun in the app at `repoRoot` (the folder of hfs.json).
 *
 * @param {{ repoRoot: string, noun: string, name: string, options?: object, now?: () => number }} input - The app root, the noun (job, reactor, queue, projection), the instance name and the options the noun needs.
 * @returns {{ created: Array<string>, registered: { patterns: Array<string>, kinds: Array<string> } }} The files written (app-root relative) and what hfs.json gained.
 */
export function addKind({ repoRoot, noun, name, options = {}, now = Date.now }) {
  const manifest = loadSlotManifest();
  const params = ruleParams(manifest, 'be');
  const spec = params.addKinds[noun];
  if (!spec) throw new ScaffoldError('HFS_ADD_NOUN_UNKNOWN', `hfs add knows ${Object.keys(params.addKinds).join(', ')}; ${noun} is none of them`);
  const declarationFile = path.join(repoRoot, 'hfs.json');
  if (!fs.existsSync(declarationFile)) throw new ScaffoldError('HFS_ADD_NOT_AN_APP', 'hfs add runs at the app root (the folder of hfs.json)');
  const repo = readRepoDeclaration(manifest, repoRoot);
  if (!repo.sides?.be) throw new ScaffoldError('HFS_ADD_NO_BACK_END', 'this app has no back-end side');
  const nouns = [noun, ...(spec.also ?? [])];
  const specs = nouns.map((each) => [each, params.addKinds[each]]);
  const patterns = [...new Set(specs.flatMap(([, eachSpec]) => eachSpec.patterns))];
  const topics = new Set([...specs.map(([, eachSpec]) => eachSpec.topic), ...topicsOfPatterns(patterns)]);
  const trees = new Map([...topics].map((topic) => [topic, readTree(topic)]));
  // The slots the noun's trees name decide whether the edition has the noun (a slot lite does not carry or forbids
  // makes it a full-edition capability); never the noun's name. Optional entries are never generated, so they gate nothing.
  const writtenSlots = new Set();
  for (const [each, eachSpec] of specs) for (const entry of trees.get(eachSpec.topic)) if (!entry.path.startsWith(PLATFORM_PREFIX) && entry.optional !== true && entry.slot) writtenSlots.add(entry.slot);
  for (const topic of topics) for (const entry of trees.get(topic)) if (entry.path.startsWith(PLATFORM_PREFIX) && entry.optional !== true && entry.slot) writtenSlots.add(entry.slot);
  refuseInEdition({ resolver: createSlotResolver(manifest, repo), slotIds: [...writtenSlots], command: `add ${noun}` });
  const values = Object.assign({}, ...specs.map(([each, eachSpec]) => variablesOf({ spec: eachSpec, noun: each, name, options })), variablesOf({ spec, noun, name, options }));
  const stamp = String(now()).padStart(13, '0').slice(0, 13);
  const withStamp = { ...values, epochMs13: stamp };
  const forms = formsOf(withStamp);
  const beRoot = path.join(repoRoot, 'be');

  const planned = [];
  const consider = (entry, topic, instance, shared = false) => {
    if (entry.optional === true) return;
    const target = fillPath(entry.path, withStamp);
    if (target === null) return;
    const absolute = path.join(beRoot, ...target.split('/'));
    // A platform capability is whole or absent: it exists when its index.ts does, and then none of its files is written again.
    if (!instance && fs.existsSync(path.join(beRoot, ...target.split('/').slice(0, 4), 'index.ts'))) return;
    if ((!instance || shared) && fs.existsSync(absolute)) return;
    if (!entry.template) throw new ScaffoldError('HFS_ADD_TEMPLATE_MISSING', `${topic}.yaml lists ${entry.path} without a template, so it cannot be generated`);
    const templateFile = path.join(PATTERN_TEMPLATES, ...entry.template.split('/'));
    if (!fs.existsSync(templateFile)) throw new ScaffoldError('HFS_ADD_TEMPLATE_MISSING', `${topic}.yaml names template ${entry.template} for ${entry.path}, which the package does not carry`);
    planned.push({ target, absolute, body: renderBody(fs.readFileSync(templateFile, 'utf8'), withStamp, forms, entry.template), instance });
  };

  for (const [each, eachSpec] of specs) for (const entry of trees.get(eachSpec.topic)) if (!entry.path.startsWith(PLATFORM_PREFIX)) consider(entry, eachSpec.topic, true, each !== noun);
  for (const topic of topics) for (const entry of trees.get(topic)) if (entry.path.startsWith(PLATFORM_PREFIX)) consider(entry, topic, false);

  const clash = planned.filter((file) => file.instance && fs.existsSync(file.absolute)).map((file) => file.target);
  if (clash.length) throw new ScaffoldError('HFS_ADD_EXISTS', `${noun} ${name} already exists: ${clash.join(', ')}`);

  for (const file of planned) {
    fs.mkdirSync(path.dirname(file.absolute), { recursive: true });
    fs.writeFileSync(file.absolute, file.body);
  }
  if (spec.wire) wire({ beRoot, wire: spec.wire, forms, noun, name });
  const registered = register({ declarationFile, spec: { patterns, trigger: spec.trigger } });
  return { created: planned.map((file) => `be/${file.target}`), registered };
}

/**
 * Registers the generated member in the static module that lists its siblings (the cli feature root lists each group module): one import
 * line after the last import and one more entry of the `imports` array of its `@Module`. Nothing happens when the member is already listed.
 */
function wire({ beRoot, wire: target, forms, noun, name }) {
  const file = path.join(beRoot, ...target.file.split('/'));
  if (!fs.existsSync(file)) throw new ScaffoldError('HFS_ADD_WIRE_MISSING', `hfs add ${noun} ${name} registers the member in ${target.file}, which does not exist`);
  const fill = (text) => text.replace(PLACEHOLDER, (whole, key) => forms[key] ?? whole);
  const symbol = fill(target.symbol);
  let text = fs.readFileSync(file, 'utf8');
  if (new RegExp(`\\b${symbol}\\b`).test(text)) return;
  const array = /@Module\(\{ imports: \[([^\]]*)\] \}\)/.exec(text);
  const lines = text.split('\n');
  const lastImport = lines.map((line) => line.startsWith('import ')).lastIndexOf(true);
  if (!array || lastImport < 0) throw new ScaffoldError('HFS_ADD_WIRE_FAILED', `${target.file} has no \`@Module({ imports: [...] })\` to register ${symbol} in`);
  lines.splice(lastImport + 1, 0, `import { ${symbol} } from "${fill(target.import)}"`);
  text = lines.join('\n').replace(array[0], `@Module({ imports: [${[array[1].trim(), symbol].filter(Boolean).join(', ')}] })`);
  fs.writeFileSync(file, text);
}

/** The topics that carry the platform capability of each pattern: the topic whose `pattern` key names it. */
function topicsOfPatterns(patterns) {
  const topics = new Set();
  for (const file of fs.readdirSync(TOPICS_DIR).filter((entry) => entry.endsWith('.yaml'))) {
    const doc = parseYaml(fs.readFileSync(path.join(TOPICS_DIR, file), 'utf8'));
    if (patterns.includes(doc?.pattern)) topics.add(file.slice(0, -'.yaml'.length));
  }
  return topics;
}

/** Adds the patterns and the trigger kind of the noun to sides.be of hfs.json, keeping its other content and key order. */
function register({ declarationFile, spec }) {
  const declaration = JSON.parse(fs.readFileSync(declarationFile, 'utf8'));
  const be = declaration.sides.be;
  const patterns = [...new Set([...(be.patterns ?? []), ...spec.patterns])].sort();
  const kinds = [...new Set([...(be.kinds ?? []), ...(spec.trigger ? [spec.trigger] : [])])].sort();
  be.patterns = patterns;
  if (kinds.length) be.kinds = kinds;
  fs.writeFileSync(declarationFile, `${JSON.stringify(declaration, null, 2)}\n`);
  return { patterns, kinds };
}
