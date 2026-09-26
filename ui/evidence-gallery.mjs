import { createHash } from 'node:crypto';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.webm': 'video/webm', '.mp4': 'video/mp4' };
const cache = new Map();
const inside = (root, target) => {
  const base = path.resolve(root).toLowerCase();
  const value = path.resolve(target).toLowerCase();
  return value.startsWith(`${base}${path.sep}`);
};
function category(relative) {
  const value = relative.replaceAll('\\', '/').toLowerCase();
  const ext = path.extname(value);
  const video = ext === '.webm' || ext === '.mp4';
  if (video) return /(^|\/)uat\/.*\/videos\/[^/]+\.(webm|mp4)$/.test(value) ? 'uat-video' : null;
  if (/(^|\/)assets\/directions\/[^/]+\.(png|jpe?g|webp)$/.test(value)
    || /(^|\/)evidence\/[^/]*\.draw(?:-\d+)?\/direction[^/]*\.(png|jpe?g|webp)$/.test(value)) return 'ai-draw';
  if (/(^|\/)(screens|screenshots|captures)\/[^/]+\.(png|jpe?g|webp)$/.test(value)) return 'screenshot';
  return null;
}
async function scanProject(project) {
  const root = path.resolve(project.repo, '.starciwork');
  const items = [];
  let visited = 0;
  async function walk(folder, depth) {
    if (depth > 13 || visited > 24000) return;
    for (const entry of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
      if (++visited > 24000) break;
      if (entry.isSymbolicLink() || entry.name === 'node_modules' || entry.name === '.git') continue;
      const absolute = path.join(folder, entry.name);
      if (entry.isDirectory()) { await walk(absolute, depth + 1); continue; }
      if (!entry.isFile()) continue;
      const relative = path.relative(root, absolute).replaceAll('\\', '/');
      const kind = category(relative);
      if (!kind) continue;
      const info = await lstat(absolute).catch(() => null);
      const maxSize = kind === 'uat-video' ? 300 * 1024 * 1024 : 25 * 1024 * 1024;
      if (!info?.isFile() || !info.size || info.size > maxSize) continue;
      const id = createHash('sha256').update(`${project.id}:${relative}`).digest('hex').slice(0, 24);
      const workflowId = /(?:^|\/)(wf-[a-z0-9._-]+)/i.exec(relative)?.[1]?.replace(/\.(?:draw|uat|work|review|scope|implement)(?:-\d+)?$/i, '') || null;
      items.push({ id, projectId: project.id, projectName: project.name, kind, name: entry.name,
        path: relative, workflowId, size: info.size, modifiedAt: info.mtimeMs, mime: types[path.extname(entry.name).toLowerCase()], absolute });
    }
  }
  for (const section of ['features', 'evidence']) await walk(path.join(root, section), 0);
  return items;
}
async function index(projects) {
  const key = projects.map((item) => item.id).join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.items;
  if (hit?.pending) return hit.pending;
  const pending = Promise.all(projects.map(scanProject)).then((groups) => {
    const items = groups.flat().sort((a, b) => b.modifiedAt - a.modifiedAt);
    cache.set(key, { at: Date.now(), items });
    return items;
  }).catch((error) => { cache.delete(key); throw error; });
  cache.set(key, { pending });
  return pending;
}
export async function listEvidence(projects, params) {
  const project = params.get('project') || 'all';
  const kind = params.get('kind') || 'all';
  const query = (params.get('q') || '').trim().toLowerCase().slice(0, 100);
  const offset = Math.min(10000, Math.max(0, Number(params.get('offset')) || 0));
  const all = await index(projects);
  const scoped = all.filter((item) => (project === 'all' || item.projectId === project)
    && (!query || `${item.path} ${item.projectName} ${item.workflowId || ''}`.toLowerCase().includes(query)));
  const counts = { all: scoped.length, 'ai-draw': 0, screenshot: 0, 'uat-video': 0 };
  for (const item of scoped) counts[item.kind]++;
  const filtered = kind === 'all' ? scoped : scoped.filter((item) => item.kind === kind);
  return { updatedAt: Date.now(), total: filtered.length, counts,
    items: filtered.slice(offset, offset + 48).map(({ absolute, mime, ...item }) => item) };
}
export async function findEvidence(projects, id) {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  const item = (await index(projects)).find((entry) => entry.id === id);
  if (!item) return null;
  const root = path.resolve(projects.find((project) => project.id === item.projectId).repo, '.starciwork');
  const real = await realpath(item.absolute).catch(() => null);
  if (!real || !inside(root, real)) return null;
  const info = await lstat(real).catch(() => null);
  if (!info?.isFile() || info.size !== item.size) return null;
  return { ...item, absolute: real };
}
