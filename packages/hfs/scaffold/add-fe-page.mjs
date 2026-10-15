import fs from "node:fs";
import path from "node:path";
import { loadSlotManifest, readRepoDeclaration } from "../runtime/scripts/hfs/slots.mjs";
import { ScaffoldError, pascalOf } from "./service.mjs";

const NAME = /^[a-z][a-z0-9-]*$/;
const RESERVED = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const objectCatalog = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Validate a CLI name before it is used in a path, symbol or catalog key. */
export function feName(value, label = "name") {
  if (typeof value !== "string" || !NAME.test(value) || value.split("-").includes("") || RESERVED.test(value)) {
    throw new ScaffoldError("HFS_ADD_NAME_INVALID", `${label} must be kebab-case, without a path or a reserved filename`);
  }
  return value;
}

/** An app-relative target whose existing ancestors are real directories, never symlinks. */
function feTarget(root, relative) {
  const target = path.resolve(root, relative);
  const inside = path.relative(root, target);
  if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) {
    throw new ScaffoldError("HFS_ADD_PATH_UNSAFE", `${relative} must stay inside the app root`);
  }
  let at = root;
  const pieces = inside.split(path.sep);
  for (let index = 0; index < pieces.length; index += 1) {
    at = path.join(at, pieces[index]);
    const stat = fs.lstatSync(at, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isSymbolicLink() || (index < pieces.length - 1 && !stat.isDirectory())) {
      throw new ScaffoldError("HFS_ADD_PATH_UNSAFE", `${relative} has a symlink or a non-directory ancestor`);
    }
  }
  return target;
}

/** Resolve the declared Next app; a multi-app repository must select one explicitly. */
export function readFeContext({ root, app }) {
  const repoRoot = path.resolve(root);
  const stat = fs.lstatSync(repoRoot, { throwIfNoEntry: false });
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new ScaffoldError("HFS_ADD_NOT_AN_APP", "add page and overlay run at a real app root directory");
  }
  const declaration = feTarget(repoRoot, "hfs.json");
  const packageFile = feTarget(repoRoot, "package.json");
  if (!fs.existsSync(declaration) || !fs.existsSync(packageFile)) {
    throw new ScaffoldError("HFS_ADD_NOT_AN_APP", "add page and overlay need hfs.json and package.json at the app root");
  }
  const repo = readRepoDeclaration(loadSlotManifest(), repoRoot);
  const apps = repo.sides?.fe?.apps.filter((candidate) => candidate.kind === "next") ?? [];
  if (!apps.length) throw new ScaffoldError("HFS_ADD_NO_FRONT_END", "this app has no declared Next front end");
  if (app !== undefined) feName(app, "app");
  if (app === undefined && apps.length !== 1) {
    throw new ScaffoldError("HFS_ADD_OPTION_MISSING", "add page and overlay need --app when several Next apps are declared");
  }
  const selected = apps.find((candidate) => candidate.name === (app ?? apps[0].name));
  if (!selected) throw new ScaffoldError("HFS_ADD_APP_UNKNOWN", `front-end app ${app} is not declared`);
  feName(selected.name, "declared app");
  return { root: repoRoot, app: selected.name, repo, source: `fe/apps/${selected.name}/src` };
}

/** Read a required owner file only after checking every path ancestor. */
export function readFeFile(context, relative) {
  const target = feTarget(context.root, relative);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new ScaffoldError("HFS_ADD_WIRE_MISSING", `${relative} is required before this feature can be added`);
  }
  return fs.readFileSync(target, "utf8");
}

/** Refuse an existing owner, including a partially generated one. */
export function requireNewFeOwner(context, relative) {
  if (fs.existsSync(feTarget(context.root, relative))) {
    throw new ScaffoldError("HFS_ADD_EXISTS", `${relative} already exists; add never replaces an existing owner`);
  }
}

function readCatalogs(context) {
  const directory = `${context.source}/modules/i18n/messages`;
  const target = feTarget(context.root, directory);
  if (!fs.existsSync(target)) throw new ScaffoldError("HFS_ADD_WIRE_MISSING", `${directory} is required`);
  if (!fs.statSync(target).isDirectory()) throw new ScaffoldError("HFS_ADD_I18N_INVALID", `${directory} must be a directory`);
  const files = fs.readdirSync(target).filter((file) => file.endsWith(".json")).sort();
  if (!["vi.json", "en.json"].every((file) => files.includes(file))) {
    throw new ScaffoldError("HFS_ADD_I18N_MISSING", `${directory} needs both vi.json and en.json`);
  }
  return files.map((file) => {
    const relative = `${directory}/${file}`;
    const before = readFeFile(context, relative);
    return { relative, before, locale: file.slice(0, -5), catalog: parseCatalog(before, relative) };
  });
}

function parseCatalog(before, relative) {
  let catalog;
  try { catalog = JSON.parse(before); } catch {
    throw new ScaffoldError("HFS_ADD_I18N_INVALID", `${relative} must contain valid JSON`);
  }
  if (!objectCatalog(catalog)) throw new ScaffoldError("HFS_ADD_I18N_INVALID", `${relative} must contain a catalog object`);
  return catalog;
}

function catalogNamespace(catalogs, app) {
  const first = catalogs[0].catalog;
  const keys = Object.keys(first);
  let namespace = keys.length === 1 ? keys[0] : app;
  if (!Object.hasOwn(first, namespace) && Object.hasOwn(first, "app")) namespace = "app";
  if (!catalogs.every(({ catalog }) => Object.hasOwn(catalog, namespace) && objectCatalog(catalog[namespace]))) {
    throw new ScaffoldError("HFS_ADD_I18N_INVALID", "the app catalogs need a shared object namespace");
  }
  return namespace;
}

function catalogCopy(locale, defaults, messages) {
  const copy = messages?.[locale] ?? defaults[locale];
  const required = Object.keys(defaults.en);
  if (!copy || !required.every((key) => typeof copy[key] === "string" && copy[key].trim())) {
    throw new ScaffoldError("HFS_ADD_I18N_INVALID", `provide the ${required.join(", ")} messages for locale ${locale}`);
  }
  return Object.fromEntries(required.map((key) => [key, copy[key]]));
}

/** Plan matching localized keys in every catalog without changing existing copy. */
export function planFeCatalogs(context, { group, name, defaults, messages }) {
  const catalogs = readCatalogs(context);
  const namespace = catalogNamespace(catalogs, context.app);
  const updates = catalogs.map(({ catalog, locale, relative, before }) => {
    const owner = catalog[namespace];
    if (owner[group] !== undefined && !objectCatalog(owner[group])) {
      throw new ScaffoldError("HFS_ADD_I18N_INVALID", `${relative}: ${namespace}.${group} must be an object`);
    }
    owner[group] ??= {};
    if (Object.hasOwn(owner[group], name)) {
      throw new ScaffoldError("HFS_ADD_EXISTS", `${relative} already declares ${namespace}.${group}.${name}`);
    }
    owner[group][name] = catalogCopy(locale, defaults, messages);
    return { relative, before, body: jsonText(catalog) };
  });
  return { namespace: `${namespace}.${group}.${name}`, updates };
}

function createParent(root, target, made) {
  const missing = [];
  for (let at = path.dirname(target); at !== root && !fs.existsSync(at); at = path.dirname(at)) missing.push(at);
  for (const directory of missing.reverse()) {
    fs.mkdirSync(directory);
    made.push(directory);
  }
}

function writeCreated(target, body, written) {
  const descriptor = fs.openSync(target, "wx");
  written.push(target);
  try { fs.writeFileSync(descriptor, body); } finally { fs.closeSync(descriptor); }
}

/** Execute a fully checked plan and restore updated owners if a write fails. */
export function writeFePlan(context, created, updates) {
  for (const file of created) requireNewFeOwner(context, file.relative);
  for (const file of updates) {
    if (readFeFile(context, file.relative) !== file.before) {
      throw new ScaffoldError("HFS_ADD_WIRE_INVALID", `${file.relative} changed while planning the feature`);
    }
  }
  const written = [];
  const updated = [];
  const directories = [];
  try {
    for (const file of created) {
      const target = feTarget(context.root, file.relative);
      createParent(context.root, target, directories);
      writeCreated(target, file.body, written);
    }
    for (const file of updates) {
      updated.push(file);
      fs.writeFileSync(feTarget(context.root, file.relative), file.body);
    }
  } catch (error) {
    for (const file of updated.reverse()) fs.writeFileSync(feTarget(context.root, file.relative), file.before);
    for (const file of written.reverse()) fs.rmSync(file);
    for (const directory of directories.reverse()) fs.rmdirSync(directory);
    throw error;
  }
  return { created: created.map((file) => file.relative), updated: updates.map((file) => file.relative) };
}

function pageSources({ name, namespace, symbol, routeSymbol }) {
  const metadata = `${name.split("-").map((word, index) => index ? pascalOf(word) : word).join("")}Metadata`;
  return {
    metadata,
    entry: `import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ${routeSymbol} } from "@/modules/routes"
import { ${symbol}Base } from "./component"

/** The localized document title and canonical destination of this page. */
export const ${metadata} = async (): Promise<Metadata> => {
    const t = await getTranslations(${JSON.stringify(namespace)})
    return { title: t("title"), alternates: { canonical: ${routeSymbol} } }
}

/** Resolve the requested locale's copy before drawing this server page. */
export const ${symbol} = async () => {
    const t = await getTranslations(${JSON.stringify(namespace)})
    return <${symbol}Base props={{ title: t("title") }} />
}
`,
    component: `import { Heading } from "@starci/grammar/common"

/** The localized words displayed by this page. */
export interface ${symbol}BaseProps {
    readonly props: { readonly title: string }
}

/** Draw the page using the settled copy supplied by its server owner. */
export const ${symbol}Base = (props: ${symbol}BaseProps) => (
    <Heading level={1}>{props.props.title}</Heading>
)
`,
  };
}

function pageRoute(symbol, metadata) {
  return `import { ${symbol} } from "@/features/pages/${symbol}"

/** The locale-aware metadata of this page. */
export { ${metadata} as generateMetadata } from "@/features/pages/${symbol}"

/** Mount the page's public server owner. */
const Page = () => <${symbol} />

export default Page
`;
}

/** Add a server page, its thin localized route and matching vi/en catalog entries. */
export function addFePage({ root, app, name, route = name, messages }) {
  feName(name, "page name");
  if (typeof route !== "string" || !route) throw new ScaffoldError("HFS_ADD_OPTION_INVALID", "--route needs one or more kebab-case path segments");
  for (const segment of route.split("/")) feName(segment, "route segment");
  const context = readFeContext({ root, app });
  const symbol = `${pascalOf(name)}Page`;
  const owner = `${context.source}/features/pages/${symbol}`;
  requireNewFeOwner(context, owner);
  const routeFile = `${context.source}/app/[locale]/${route}/page.tsx`;
  requireNewFeOwner(context, routeFile);
  const catalogs = planFeCatalogs(context, {
    group: "pages", name, messages,
    defaults: { vi: { title: "Trang m\u1edbi" }, en: { title: "New page" } },
  });
  const routeSymbol = `${name.replaceAll("-", "_").toUpperCase()}_PAGE_ROUTE`;
  const routesFile = `${context.source}/modules/routes/index.ts`;
  const before = readFeFile(context, routesFile);
  if (before.split(/[^A-Za-z0-9_]/).includes(routeSymbol)) {
    throw new ScaffoldError("HFS_ADD_EXISTS", `${routesFile} already declares ${routeSymbol}`);
  }
  const sources = pageSources({ name, namespace: catalogs.namespace, symbol, routeSymbol });
  const created = [
    { relative: `${owner}/index.tsx`, body: sources.entry },
    { relative: `${owner}/component.tsx`, body: sources.component },
    { relative: routeFile, body: pageRoute(symbol, sources.metadata) },
  ];
  const destination = `/${route}`;
  const routeBody = `${before.trimEnd()}\n\n/** The canonical destination of the ${symbol} owner. */\nexport const ${routeSymbol} = ${JSON.stringify(destination)} as const\n`;
  const updates = [...catalogs.updates, { relative: routesFile, before, body: routeBody }];
  return { ...writeFePlan(context, created, updates), registered: { app: context.app, page: symbol, route: destination } };
}
