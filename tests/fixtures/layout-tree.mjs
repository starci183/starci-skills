// A two-repository product for the layout-tree specs: tmp/backend/.starciwork beside tmp/web, whose
// apps/app/src/app is a small Next.js App Router tree with every construct the scanner reads - a locale
// segment, a route group without a layout, a route group with the console layout, a nested layout, loading and
// error files, a parallel @modal slot with an intercepting (.)photos/[id] route beside the full page, and a
// navigation registry whose labels live in two message catalogs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { blankImage, drawOver, encodePng } from '../../scripts/work/png.mjs';

export const APP_FILES = {
  'apps/app/tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }, null, 2),
  'apps/app/src/i18n/config.ts': 'export const LOCALES = ["vi", "en"] as const\nexport const DEFAULT_LOCALE = "vi"\n',
  'apps/app/src/messages/vi.json': JSON.stringify({ console: { nav: { photos: 'Ảnh', help: 'Trợ giúp' } } }),
  'apps/app/src/messages/en.json': JSON.stringify({ console: { nav: { photos: 'Photos', billing: 'Billing', help: 'Help' } } }),
  'apps/app/src/app/[locale]/layout.tsx': 'import { AppProviders } from "../providers"\nconst RootLayout = async ({ children }: { children: React.ReactNode }): Promise<Metadata> => <html><body><AppProviders>{children}</AppProviders></body></html>\nexport default RootLayout\n',
  'apps/app/src/app/providers.tsx': 'export const AppProviders = ({ children }) => children\n',
  'apps/app/src/app/[locale]/(auth)/sign-in/page.tsx': 'export default () => <main>Sign in</main>\n',
  'apps/app/src/app/[locale]/(console)/layout.tsx': 'import { ConsoleLayout } from "@/shell/ConsoleLayout"\nexport default function Layout({ children, modal }) { return <ConsoleLayout>{children}{modal}</ConsoleLayout> }\n',
  'apps/app/src/shell/ConsoleLayout.tsx': 'import { Sidebar } from "./Sidebar"\nexport const ConsoleLayout = ({ children }) => <div><Sidebar />{children}</div>\n',
  'apps/app/src/shell/Sidebar.tsx': [
    'import { useTranslations } from "next-intl"',
    'const DESTINATIONS = [',
    '  { key: "photos", route: "/photos", group: "main" },',
    '  { key: "billing", route: "/billing", group: "main" },',
    '  { key: "help", route: null, group: "account" },',
    ']',
    'export const Sidebar = () => { const t = useTranslations("console"); return <nav>{DESTINATIONS.map((d) => <a key={d.key}>{t(`nav.${d.key}`)}</a>)}</nav> }',
    '',
  ].join('\n'),
  'apps/app/src/app/[locale]/(console)/photos/layout.tsx': 'import { PhotoTabs } from "@/shell/PhotoTabs"\nexport default ({ children }) => <PhotoTabs>{children}</PhotoTabs>\n',
  'apps/app/src/shell/PhotoTabs.tsx': 'export const PhotoTabs = ({ children }) => <section>{children}</section>\n',
  'apps/app/src/app/[locale]/(console)/photos/page.tsx': 'export default () => <main>Photos</main>\n',
  'apps/app/src/app/[locale]/(console)/photos/loading.tsx': 'export default () => <p>Loading</p>\n',
  'apps/app/src/app/[locale]/(console)/photos/error.tsx': '"use client"\nexport default () => <p>Error</p>\n',
  'apps/app/src/app/[locale]/(console)/photos/[id]/page.tsx': 'export default () => <main>Photo</main>\n',
  'apps/app/src/app/[locale]/(console)/@modal/default.tsx': 'export default () => null\n',
  'apps/app/src/app/[locale]/(console)/@modal/(.)photos/[id]/page.tsx': 'export default () => <dialog>Photo</dialog>\n',
  'apps/app/src/app/[locale]/(console)/reports/page.tsx': 'export default () => <main>Reports</main>\n',
  'apps/app/src/app/[locale]/(console)/_components/Chart.tsx': 'export const Chart = () => null\n',
};

/** A W x H PNG image: a chrome colour everywhere and the page slot keyed #FF00FF. */
export function layoutCapture(width, height, slot, chrome = [30, 60, 90, 255]) {
  const image = blankImage(width, height, chrome);
  drawOver(image, blankImage(slot.width, slot.height, [255, 0, 255, 255]), slot.x, slot.y);
  return image;
}

export const pngBytes = (image) => encodePng(image);

/**
 * The product with a settled layout tree written: breakpoints desktop 40x30 and mobile 20x30, theme light,
 * the (console) layout visible and captured with its slot keyed, every other layout a passthrough, a
 * lockup and one persona. Returns the product plus `tree` (the record) and `save(tree)`.
 */
export async function settledProduct(t, { photosVisible = false } = {}) {
  const { mergeScan, scanAppDir, addCapture, nodeById } = await import('../../scripts/work/layout-tree.mjs');
  const p = buildProduct(t);
  const tree = mergeScan(null, scanAppDir(p.appDir, { repoRoot: p.web, repository: 'web' }), { at: '2026-09-24T00:00:00Z' }).record;
  tree.breakpoints = [{ name: 'desktop', width: 40, height: 30 }, { name: 'mobile', width: 20, height: 30 }];
  tree.themes = ['light'];
  const shellDir = path.join(p.work, 'shell');
  const consoleNode = nodeById(tree, '/[locale]/(console)');
  addCapture(tree, shellDir, { node: consoleNode.id, breakpoint: 'desktop', theme: 'light', file: p.put('cap-d.png', encodePng(layoutCapture(40, 30, { x: 10, y: 5, width: 28, height: 22 }))) });
  addCapture(tree, shellDir, { node: consoleNode.id, breakpoint: 'mobile', theme: 'light', file: p.put('cap-m.png', encodePng(layoutCapture(20, 30, { x: 0, y: 6, width: 20, height: 24 }))) });
  consoleNode.layout.state = 'done';
  const photos = nodeById(tree, '/[locale]/(console)/photos');
  photos.layout.chrome = photosVisible ? 'visible' : 'passthrough';
  photos.layout.state = photosVisible ? 'todo' : 'done';
  p.put('backend/.starciwork/shell/assets/lockup.png', encodePng(blankImage(4, 2, [0, 0, 0, 255])));
  const { createHash } = await import('node:crypto');
  const lockupSha = createHash('sha256').update(fs.readFileSync(path.join(shellDir, 'assets', 'lockup.png'))).digest('hex');
  tree.brand = { component: 'PhotoBrand', lockups: [{ path: 'assets/lockup.png', sha256: lockupSha, theme: 'light' }] };
  tree.personas = [{ role: 'owner', default: true, workspace: 'Studio', user: 'An Nguyen', currency: 'VND', dateFormat: 'dd/MM/yyyy' }];
  tree.state = 'done';
  const save = (record) => fs.writeFileSync(path.join(shellDir, 'index.yaml'), stringifyYaml(record));
  save(tree);
  return { ...p, tree, save, shellDir };
}

/**
 * Write a ui record, generate its content images and compose each draw through the real compositor, then
 * record the printed asset entries. `draws`: [{breakpoint, theme, presentation?, state?, color?, size?}].
 */
export async function drawUi(p, rel, record, draws, { prompt = 'Reports board content. Product locale: vi.' } = {}) {
  const { composeDirection } = await import('../../scripts/work/compose-direction.mjs');
  const dir = path.join(p.work, 'features', rel);
  const file = path.join(dir, 'index.yaml');
  fs.mkdirSync(path.join(dir, 'assets', 'directions'), { recursive: true });
  fs.writeFileSync(file, stringifyYaml(record));
  const assets = [];
  for (const d of draws) {
    const state = d.state ?? 'default';
    const name = `${state}--${d.presentation ?? 'auto'}--${d.breakpoint}--${d.theme}.content`;
    const [w, h] = d.size ?? [14, 11];
    const content = path.join(dir, 'assets', 'directions', `${name}.png`);
    fs.writeFileSync(content, encodePng(blankImage(w, h, d.color ?? [200, 120, 40, 255])));
    fs.writeFileSync(content.replace(/\.png$/, '.prompt.txt'), prompt);
    const result = composeDirection({ uiDir: dir, content, breakpoint: d.breakpoint, theme: d.theme, state, presentation: d.presentation ?? null });
    if (!result.ok) throw new Error(result.error);
    assets.push(result.contentAsset, result.asset);
  }
  const written = { ...record, assets: [...(record.assets ?? []), ...assets] };
  fs.writeFileSync(file, stringifyYaml(written));
  return { dir, file, record: written };
}

/** A ui record skeleton that validates against work/ui-screen@1's required keys. */
export const uiSkeleton = (id, over = {}) => ({
  schema: 'work/ui-screen@1', id, title: id, state: 'todo', brand: { rev: 1 }, refs: ['fr.x.y'],
  ui: { status: 'proposed', intent: 'fixture' }, ...over,
});

/** Build the product under a fresh temp directory; returns helpers. `t` is the node:test context. */
export function buildProduct(t, { files = APP_FILES } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-layout-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const work = path.join(base, 'backend', '.starciwork');
  const put = (rel, body) => { const file = path.join(base, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); return file; };
  put('backend/.starciwork/workspace.yaml', stringifyYaml({ schema: 'work/workspace@1', id: 'photo', repositories: [{ role: 'be', name: 'backend' }, { role: 'fe', name: 'web' }] }));
  for (const [rel, body] of Object.entries(files)) put(`web/${rel}`, body);
  return { base, work, web: path.join(base, 'web'), appDir: path.join(base, 'web', 'apps', 'app', 'src', 'app'), put };
}
