import fs from 'node:fs';
import { ScaffoldError } from './service.mjs';

const CALLBACK_SLOT = 'fe.route.callback';
const CALLBACK_ROUTE = '/src/app/auth/callback/route.ts';
const CALLBACK_OWNER = '/src/modules/auth/server.ts';
const CALLBACK_BROWSER = '/src/modules/auth/client.ts';
const CALLBACK_CONFIG = '/src/modules/config/index.ts';
const GUIDE_ENTRY = '/src/features/overlays/AppGuideOverlay/index.tsx';
const HOME_ENTRY = '/src/features/pages/AppHomePage/index.tsx';
const CALLBACK_DEPENDENCIES = ['@supabase/ssr', '@supabase/supabase-js', 'server-only'];
const CLIENT_IMPORT = 'import { createClient } from "@supabase/supabase-js"';
const BROWSER_IMPORT = 'import { createBrowserClient } from "@supabase/ssr"';
const CLIENT_CALL = 'createClient(supabaseUrl(), supabaseAnonKey(), {';
const BROWSER_CALL = 'createBrowserClient(supabaseUrl(), supabaseAnonKey(), {';

const authTemplate = edition => fs.readFileSync(new URL(`../templates/fe/${edition}/apps/__app__/src/modules/auth/client.ts`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');

function validateAuthCallback(authCallback) {
  if (typeof authCallback !== 'boolean') throw new ScaffoldError('HFS_SCAFFOLD_CALLBACK_OPTION', 'authCallback must be a boolean');
}

/** The server owner and the SSR client's peer are declared at the package's canon pins only when that flow is requested. */
export function addAuthCallbackDependencies(pkg, pins, authCallback = false) {
  validateAuthCallback(authCallback);
  if (!authCallback) return;
  const dependencies = CALLBACK_DEPENDENCIES.map(name => {
    const version = pins[name]?.version;
    if (!version) throw new ScaffoldError('HFS_SCAFFOLD_PIN_MISSING', `${name} has no canon pin for the callback auth owner`);
    return [name, version];
  });
  pkg.dependencies ??= {};
  Object.assign(pkg.dependencies, Object.fromEntries(dependencies));
}

/** Register the server PKCE flow only when requested and backed by a declared Supabase connection. */
export function enableAuthCallback(declaration, authCallback = false) {
  validateAuthCallback(authCallback);
  if (!authCallback) return;
  const sides = Object.values(declaration.sides ?? {});
  const supabase = sides.some(side => side.connections?.some(connection => connection.provider === 'supabase'));
  if (!supabase) throw new ScaffoldError('HFS_SCAFFOLD_CALLBACK_PROVIDER', 'authCallback needs a declared connection with provider supabase');
  const fe = declaration.sides?.fe;
  if (!fe) throw new ScaffoldError('HFS_SCAFFOLD_CALLBACK_SIDE', 'authCallback needs a front-end side');
  fe.optionalSlots = [...new Set([...(fe.optionalSlots ?? []), CALLBACK_SLOT])];
  const posture = declaration.supabase;
  if (posture?.siteUrl) posture.redirectUrls = [...new Set([...(posture.redirectUrls ?? []), new URL('/auth/callback', posture.siteUrl).href])];
}

function configuredAuth(content, config) {
  const readers = [];
  if (!content.includes('export const supabaseUrl')) readers.push(
    '/** The public Supabase project origin, read by modules/auth only. */',
    'export const supabaseUrl = (): string => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)',
  );
  if (!content.includes('export const supabaseAnonKey')) readers.push(
    '/** The public anonymous key of Supabase Auth; access tokens are verified by the back end. */',
    'export const supabaseAnonKey = (): string => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)',
  );
  if (!readers.length) return content;
  if (!content.includes('const required =')) throw new ScaffoldError('HFS_SCAFFOLD_CALLBACK_CONFIG_INVALID', `${config} needs the canonical lazy required environment reader`);
  return [content.trimEnd(), ...readers, ''].join('\n');
}

function callbackConfigs(files, routes) {
  const configs = new Set(routes.map(route => route.path.slice(0, -CALLBACK_ROUTE.length) + CALLBACK_CONFIG));
  for (const config of configs) {
    if (!files.some(file => file.path === config)) throw new ScaffoldError('HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING', `the callback config owner ${config} is not carried by this package`);
  }
  return files.map(file => configs.has(file.path) ? { ...file, content: configuredAuth(file.content, file.path) } : file);
}

/** The browser and server owners share cookie storage for both the verifier and the exchanged session. */
function cookieAuthClient(content, owner) {
  if (content.includes(BROWSER_IMPORT) && content.includes(BROWSER_CALL) && content.includes('detectSessionInUrl: false')) return content;
  const source = content.trim() === authTemplate('skeleton').trim() ? authTemplate('skeleton-lite') : content;
  if (!source.includes(CLIENT_IMPORT) || !source.includes(CLIENT_CALL) || !source.includes('detectSessionInUrl: true')) {
    throw new ScaffoldError('HFS_SCAFFOLD_CALLBACK_CLIENT_INVALID', `${owner} needs the canonical Supabase browser owner or the shared unconfigured AuthClient stub`);
  }
  const cookieClient = source.replace(CLIENT_IMPORT, BROWSER_IMPORT).replace(CLIENT_CALL, BROWSER_CALL).replace('detectSessionInUrl: true', 'detectSessionInUrl: false');
  const description = [
    '/**',
    ' * The Supabase Auth client stores its PKCE verifier and session in cookies shared with the server callback.',
    ' * The callback exchanges the returning code; this browser owner reads the resulting session and refreshes it.',
    ' * Application data still goes through modules/api to the back end, which verifies the access token.',
    ' */',
  ].join('\n');
  const commentStart = cookieClient.indexOf('/**');
  const commentEnd = cookieClient.indexOf('*/', commentStart);
  const described = commentStart < 0 || commentEnd < 0 ? cookieClient : cookieClient.slice(0, commentStart) + description + cookieClient.slice(commentEnd + 2);
  return described.replace('The identity-provider client of a lite app:', 'The identity-provider client of a Supabase callback app:');
}

function callbackBrowsers(files, routes) {
  const owners = new Set(routes.map(route => route.path.slice(0, -CALLBACK_ROUTE.length) + CALLBACK_BROWSER));
  for (const owner of owners) {
    if (!files.some(file => file.path === owner)) throw new ScaffoldError('HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING', `the callback browser owner ${owner} is not carried by this package`);
  }
  return files.map(file => owners.has(file.path) ? { ...file, content: cookieAuthClient(file.content, file.path) } : file);
}

function callbackFiles(files, authCallback) {
  if (!authCallback) return files.filter(file => !file.path.endsWith(CALLBACK_ROUTE) && !file.path.endsWith(CALLBACK_OWNER));
  const routes = files.filter(file => file.path.endsWith(CALLBACK_ROUTE));
  if (!routes.length) throw new ScaffoldError('HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING', 'the opt-in callback route template is not carried by this package');
  for (const route of routes) {
    const owner = route.path.slice(0, -CALLBACK_ROUTE.length) + CALLBACK_OWNER;
    if (!files.some(file => file.path === owner)) throw new ScaffoldError('HFS_SCAFFOLD_CALLBACK_TEMPLATE_MISSING', `the callback auth owner ${owner} is not carried by this package`);
  }
  return callbackBrowsers(callbackConfigs(files, routes), routes);
}

/** Keep the canonical home implementation and its metadata; a server wrapper mounts the connected guide beside it. */
function mountedHome(content, host) {
  if (content.includes('<AppGuideOverlay')) return content;
  const declaration = 'export const AppHomePage = ';
  if (content.split(declaration).length !== 2) throw new ScaffoldError('HFS_SCAFFOLD_OVERLAY_HOST_INVALID', `${host} needs the canonical AppHomePage entry before its guide can be mounted`);
  const page = content.replace(declaration, 'const AppHomePageContent = ');
  return [
    'import { AppGuideOverlay } from "@/features/overlays/AppGuideOverlay"',
    page.trimEnd(),
    '',
    '/** The home page and its connected guide, mounted by the same server owner. */',
    'export const AppHomePage = () => <><AppHomePageContent /><AppGuideOverlay /></>',
    '',
  ].join('\n');
}

function mountGuides(files) {
  const hosts = new Set(files.filter(file => file.path.endsWith(GUIDE_ENTRY)).map(file => file.path.slice(0, -GUIDE_ENTRY.length) + HOME_ENTRY));
  for (const host of hosts) {
    if (!files.some(file => file.path === host)) throw new ScaffoldError('HFS_SCAFFOLD_OVERLAY_HOST_MISSING', `the guide overlay needs its home page ${host}`);
  }
  return files.map(file => hosts.has(file.path) ? { ...file, content: mountedHome(file.content, file.path) } : file);
}

/** The rendered FE trees of either edition share the same opt-in callback and mounted overlay policy. */
export function applyFeTemplatePolicy(files, { authCallback = false } = {}) {
  validateAuthCallback(authCallback);
  return mountGuides(callbackFiles(files, authCallback));
}
