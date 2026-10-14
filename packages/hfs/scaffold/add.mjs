// starci app add <noun> <name> - generates exactly one kind's file tree FROM the pattern knowledge files.
//
// The `files:` tree of a pattern topic (knowledge/patterns/be/<topic>.yaml) is the single source of what the pattern places: its paths, the
// slot that owns each, the rules that judge it, and the one content body (`template`, a file under templates/be/patterns/) of each. This
// module reads the tree of the noun's topic (`ruleParams.be.addKinds` names it), fills the path variables, writes each instance file that
// does not exist, adds the platform capabilities the noun's patterns need when they are missing, and registers the patterns and the trigger
// kind in hfs.json (`sides.be.patterns`, `sides.be.kinds`). There is no second list of files and no second copy of a body: a kind is only
// generated when it is used, so an empty kind folder never exists.
//
//   starci app add job send-receipt                      features/jobs/send-receipt: module, processor, one step; the platform jobs and queue capabilities
//   starci app add reactor payment-status --event payment-settled --from payment --service PaymentStatusService=@modules/domain/order
//   starci app add queue receipt                          modules/queues/receipt: the typed producer
//   starci app add projection order-summary --connection order
//
// Body placeholders: for each variable `v` of the tree (job, step, event, ...) `@@v@@` is its kebab name, `@@V@@` its PascalCase and
// `@@vCamel@@` its camelCase, `@@vUpper@@` its UPPER_SNAKE and `@@vSnake@@` its snake_case; the option `--service Class=module` gives `@@service@@` (the class) and `@@serviceModule@@`.
import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATES_DIR } from '../sync/index.mjs';
import { ScaffoldError, pascalOf } from './service.mjs';
import { addTable, graphqlPlatformFiles } from './add-table.mjs';
import { addApp } from './add-app.mjs';
import { ensureLiteCli } from './add-cli-lite.mjs';
import { addLiteWebhookInbox } from './add-inbox-lite.mjs';
import { addBuiltinLiteCli, fillKnownForms, formsOf, planKind, readAddContext } from './add-plan.mjs';
export { liteApiTemplates } from './add-plan.mjs';
import { bundledPins, jsonText, packageJsonText, peerDependencies } from './app.mjs';
import { byCodeUnit } from '../report/order.mjs';
import { registerLiteDomainService, registerLiteExports } from './lite-exports.mjs';

/**
 * Generates the tree of one noun in the app at `repoRoot` (the folder of hfs.json).
 *
 * @param {{ repoRoot: string, noun: string, name: string, options?: object, now?: () => number }} input - The app root, the noun (job, reactor, queue, projection), the instance name and the options the noun needs.
 * @returns {{ created: Array<string>, registered: { patterns: Array<string>, kinds: Array<string> } }} The files written (app-root relative) and what hfs.json gained.
 */
export function addKind({ repoRoot, noun, name, options = {}, now = Date.now }) {
  if (noun === 'table') {
    const result = addTable({ root: repoRoot, name, fe: options.fe === true, emitTypes: options.noTypes === true ? false : options.emitTypes, now });
    return { ...result, registered: { patterns: [], kinds: [] } };
  }
  if (noun === 'app') {
    const result = addApp({ root: repoRoot, name });
    return { ...result, registered: { patterns: [], kinds: [] } };
  }
  const context = readAddContext({ repoRoot, noun, name, options, now });
  const builtin = addBuiltinLiteCli(context);
  if (builtin) return builtin;
  return writeKind({ ...context, ...planKind(context) });
}

function registerFeatureExports({ repoRoot, repo, noun, values }) {
  if (noun === 'webhook' || (repo.edition === 'lite' && noun === 'api')) {
    registerLiteExports({ root: repoRoot, generator: repo.edition === 'lite' ? noun : 'webhook-full' });
  }
  if (repo.edition === 'lite' && noun === 'api') {
    registerLiteDomainService({ root: repoRoot, moduleSpecifier: values.serviceModule, service: values.service });
  }
}

function writeKind({ repoRoot, noun, name, now, manifest, repo, spec, declarationFile, values, forms, beRoot, patterns, planned }) {
  const bootstrapCreated = noun === 'cli' && repo.edition === 'lite' ? ensureLiteCli({ root: repoRoot, manifest, repo }) : [];
  for (const file of planned) {
    fs.mkdirSync(path.dirname(file.absolute), { recursive: true });
    fs.writeFileSync(file.absolute, file.body);
  }
  registerFeatureExports({ repoRoot, repo, noun, values });
  if (spec.wire) wire({ beRoot, wire: spec.wire, forms, noun, name });
  const platformCreated = repo.edition === 'lite' && (noun === 'api' || noun === 'webhook') ? wireLiteFeature({ repoRoot, repo, noun, name }) : [];
  const inboxCreated = addLiteWebhookInbox({ root: repoRoot, repo, noun, provider: name, values, now });
  const graphqlDoor = noun === 'api' ? ensureGraphqlPeers(repoRoot) : [];
  const registered = register({ declarationFile, spec: { patterns, trigger: spec.trigger, optionalSlots: noun === 'api' ? [GRAPHQL_CONTRACT_SLOT] : [] } });
  return { created: [...bootstrapCreated, ...planned.map((file) => `be/${file.target}`), ...platformCreated, ...inboxCreated, ...graphqlDoor], registered };
}

/** The slot of the emitted GraphQL snapshot (contracts/<app>/schema.graphql), which an app serving a GraphQL api feature opts into. */
const GRAPHQL_CONTRACT_SLOT = 'be.contract.graphql';

/**
 * Declares, in the app root package.json, the runtime peers its GraphQL api needs (R111, knowledge/hfs/peer-integrations.yaml) at
 * their canon pins; returns ['package.json'] when it changed, else []. Both editions.
 */
function ensureGraphqlPeers(repoRoot) {
  const file = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(file)) throw new ScaffoldError('HFS_ADD_NOT_AN_APP', 'add api needs the app root package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const peers = peerDependencies(pkg, bundledPins());
  if (!Object.keys(peers).length) return [];
  pkg.dependencies = Object.fromEntries(Object.entries({ ...pkg.dependencies, ...peers }).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(file, packageJsonText(pkg));
  return ['package.json'];
}

/** Adds `importLine` and one `symbol` entry of the `imports` array of a module file's lines, once. */
function addModuleImport(lines, { importLine, entry, relative, noun }) {
  if (lines.includes(importLine)) return;
  const lastImport = lines.reduce((last, line, index) => line.startsWith('import ') ? index : last, -1);
  if (lastImport < 0 || lines.findIndex(line => /^\s*imports: \[$/.test(line)) < 0) throw new ScaffoldError('HFS_ADD_WIRE_INVALID', `add ${noun} could not find the imports array in ${relative}`);
  lines.splice(lastImport + 1, 0, importLine);
  const imports = lines.findIndex(line => /^\s*imports: \[$/.test(line));
  const indent = /^(\s*)/.exec(lines[imports])?.[1] ?? '';
  lines.splice(imports + 1, 0, `${indent}    ${entry},`);
}

/** The GraphQL server capability (be/src/modules/platform/graphql), written whole by the first GraphQL feature of an app that has none. */
function ensureGraphqlPlatform(repoRoot) {
  if (fs.existsSync(path.join(repoRoot, 'be', 'src', 'modules', 'platform', 'graphql', 'index.ts'))) return [];
  const written = [];
  for (const { relative, body } of graphqlPlatformFiles()) {
    const file = path.join(repoRoot, ...relative.split('/'));
    if (fs.existsSync(file)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    written.push(relative);
  }
  registerLiteExports({ root: repoRoot, generator: 'graphql' });
  return written;
}

/**
 * Lite has one API app; compose each generated transport into that app immediately: an api feature's GraphQL module (with the
 * GraphQL server on first use), a webhook's HTTP door.
 */
function wireLiteFeature({ repoRoot, repo, noun, name }) {
  const app = repo.sides.be.apps.find(entry => entry.kind === 'api');
  if (!app) throw new ScaffoldError('HFS_ADD_NO_API_OWNER', `add ${noun} needs a declared lite api app`);
  const relative = `be/apps/${app.name}/src/app.module.ts`;
  const file = path.join(repoRoot, ...relative.split('/'));
  if (!fs.existsSync(file)) throw new ScaffoldError('HFS_ADD_WIRE_MISSING', `add ${noun} registers its transport in ${relative}, which does not exist`);
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const created = [];
  if (noun === 'api') {
    created.push(...ensureGraphqlPlatform(repoRoot));
    addModuleImport(lines, { importLine: 'import { GraphqlModule } from "@modules/platform/graphql"', entry: 'GraphqlModule.register({ isGlobal: true })', relative, noun });
    const symbol = `${pascalOf(name)}GraphqlModule`;
    addModuleImport(lines, { importLine: `import { ${symbol} } from "@features/api/${name}"`, entry: symbol, relative, noun });
  } else {
    const symbol = `${pascalOf(name)}HttpModule`;
    addModuleImport(lines, { importLine: `import { ${symbol} } from "@features/webhooks/${name}"`, entry: symbol, relative, noun });
  }
  fs.writeFileSync(file, `${lines.join('\n').replace(/\n+$/, '')}\n`);
  if (noun === 'webhook') wireLiteWebhookConfig({ repoRoot, app: app.name, provider: name });
  return created;
}

/** Adds one generated webhook provider to the lite API's typed env reader (or an existing inline bootstrap) and enables exact raw-body verification. */
function wireLiteWebhookConfig({ repoRoot, app, provider }) {
  const envRelative = `be/apps/${app}/src/${app}.env.ts`;
  const relative = fs.existsSync(path.join(repoRoot, ...envRelative.split('/')))
    ? envRelative
    : `be/apps/${app}/src/main.ts`;
  const file = path.join(repoRoot, ...relative.split('/'));
  let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const httpSecurityImport = /^import \{ ([^}]+) \} from "@modules\/platform\/http-security"$/m;
  const importMatch = httpSecurityImport.exec(text);
  if (!importMatch) throw new ScaffoldError('HFS_ADD_WIRE_INVALID', `add webhook could not find the HTTP security import in ${relative}`);
  const imported = importMatch[1].split(',').map(symbol => symbol.trim()).filter(Boolean);
  if (!imported.includes('parseWebhookProviderConfig')) {
    const configIndex = imported.indexOf('parseHttpSecurityConfig');
    imported.splice(configIndex < 0 ? imported.length : configIndex + 1, 0, 'parseWebhookProviderConfig');
    text = text.replace(httpSecurityImport, `import { ${imported.join(', ')} } from "@modules/platform/http-security"`);
  }
  const providerKey = /^[a-z][a-z0-9]*$/.test(provider) ? provider : JSON.stringify(provider);
  const indent = /^([ \t]*)httpSecurity:/m.exec(text)?.[1] ?? '        ';
  const providerLine = `${indent}        ${providerKey}: parseWebhookProviderConfig(env, ${JSON.stringify(formsOf({ provider }).providerUpper)}),`;
  if (!text.includes(providerLine)) {
    const empty = /httpSecurity:\s*parseHttpSecurityConfig\(env\)/;
    if (empty.test(text)) {
      text = text.replace(empty, ['httpSecurity: {', `${indent}    ...parseHttpSecurityConfig(env),`, `${indent}    webhooks: {`, providerLine, `${indent}    },`, `${indent}}`].join('\n'));
    } else {
      const found = /^\s*webhooks: \{$/m.exec(text);
      if (!found) throw new ScaffoldError('HFS_ADD_WIRE_INVALID', `add webhook could not find httpSecurity options in ${relative}`);
      const insertAt = found.index + found[0].length;
      text = `${text.slice(0, insertAt)}\n${providerLine}${text.slice(insertAt)}`;
    }
  }
  text = text.replace('NestFactory.create(AppModule.register(options))', 'NestFactory.create(AppModule.register(options), { rawBody: true })');
  fs.writeFileSync(file, text);
  if (relative === envRelative) {
    const main = path.join(repoRoot, 'be', 'apps', app, 'src', 'main.ts');
    const entry = fs.readFileSync(main, 'utf8').replace('NestFactory.create(AppModule.register(options))', 'NestFactory.create(AppModule.register(options), { rawBody: true })');
    fs.writeFileSync(main, entry);
  }
}

/**
 * Registers the generated member in the static module that lists its siblings (the cli feature root lists each group module): one import
 * line after the last import and one more entry of the `imports` array of its `@Module`. Nothing happens when the member is already listed.
 */
function wire({ beRoot, wire: target, forms, noun, name }) {
  const file = path.join(beRoot, ...target.file.split('/'));
  if (!fs.existsSync(file)) throw new ScaffoldError('HFS_ADD_WIRE_MISSING', `starci app add ${noun} ${name} registers the member in ${target.file}, which does not exist`);
  const fill = (text) => fillKnownForms(text, forms);
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

/** Adds the patterns, the trigger kind and the opt-in slots of the noun to sides.be of hfs.json, keeping its other content and key order. */
function register({ declarationFile, spec }) {
  const declaration = JSON.parse(fs.readFileSync(declarationFile, 'utf8'));
  const be = declaration.sides.be;
  const patterns = [...new Set([...(be.patterns ?? []), ...spec.patterns])].sort(byCodeUnit);
  const kinds = [...new Set([...(be.kinds ?? []), ...(spec.trigger ? [spec.trigger] : [])])].sort(byCodeUnit);
  be.patterns = patterns;
  if (kinds.length) be.kinds = kinds;
  if (spec.optionalSlots.some(slot => !(be.optionalSlots ?? []).includes(slot))) be.optionalSlots = [...new Set([...(be.optionalSlots ?? []), ...spec.optionalSlots])].sort(byCodeUnit);
  fs.writeFileSync(declarationFile, jsonText(declaration));
  return { patterns, kinds };
}
