import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite'; // eslint-disable-line no-unused-vars
import { openLedgerReader } from '../engine/ledger-db.mjs';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { redactLogLine } from './agent-monitor.mjs';
import { jobWorktreeOf } from '../scripts/kernel/product-worktree.mjs';

const run = promisify(execFile);
// The host holding .claude and .workspaces; STARCI_STATUS_SOURCE names it when this checkout is a lane worktree.
const source = path.resolve(process.env.STARCI_STATUS_SOURCE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.html', '.json', '.yaml', '.yml', '.md']);
const imageTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const inside = (root, target) => {
  const parent = path.resolve(root).toLowerCase();
  const child = path.resolve(target).toLowerCase();
  return child === parent || child.startsWith(`${parent}${path.sep}`);
};
const ownedPath = (value) => {
  if (typeof value !== 'string' || !value || value.includes('\0') || path.isAbsolute(value) || /^[a-z]:/i.test(value)) return null;
  const parts = value.replaceAll('\\', '/').split('/');
  if (parts.some((part) => part === '..' || part === '.' || part === '.git' || part === 'node_modules')) return null;
  return parts.filter(Boolean).join('/');
};
const codePath = (value) => {
  const name = value.replaceAll('\\', '/');
  if (name.startsWith('.starciwork/') || /(^|\/)(?:\.secrets|node_modules|dist)\//i.test(name)) return false;
  if (/(^|\/)(?:\.env(?:\.|$)|[^/]+\.(?:key|pem|p12|pfx))$/i.test(name)) return false;
  return codeExtensions.has(path.extname(name).toLowerCase());
};
const git = async (repo, args, maxBuffer = 4 * 1024 * 1024) => {
  const { stdout } = await run('git', ['-c', 'core.fsmonitor=false', '-C', repo, ...args], {
    cwd: repo, timeout: 12_000, maxBuffer, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat' },
  });
  return stdout;
};
const nulList = (value) => value.split('\0').filter(Boolean);
const sanitizePatch = (value) => value.split(/\r?\n/).slice(0, 2400).map((line) => redactLogLine(line, 500)).join('\n').slice(0, 120_000);

function activeJob(project, jobId) {
  if (!/^op-[a-z0-9.-]{1,100}$/i.test(jobId)) throw new Error('Job không hợp lệ');
  const db = openLedgerReader(path.join(project.repo, '.starciwork', 'runtime.sqlite'));
  try {
    const row = db.prepare("SELECT payload_json, created_at FROM jobs WHERE job_id=? AND kind<>'kernel' AND status IN ('running','answering','leased')").get(jobId);
    if (!row) throw new Error('Op không còn đang chạy');
    const payload = JSON.parse(row.payload_json || '{}');
    // The op's own product worktree (scripts/kernel/product-worktree.mjs record); a retry's payload may carry its
    // predecessor's record, so only a record naming this job (or naming none) counts.
    const record = jobWorktreeOf(payload);
    const own = record && (!record.jobId || record.jobId === jobId) ? record : null;
    return { paths: [...new Set((Array.isArray(payload.owned_paths) ? payload.owned_paths : []).map(ownedPath).filter(Boolean))].slice(0, 80), since: row.created_at, worktree: own };
  } finally { db.close(); }
}

async function repositories(project) {
  const folder = project.id === 'mia-mia' ? 'miamia' : project.id;
  const binding = JSON.parse(await readFile(path.join(source, '.workspaces', 'projects', folder, 'work.json'), 'utf8'));
  const be = path.resolve(source, binding.repositories.be.pathFromSource);
  if (be.toLowerCase() !== path.resolve(project.repo).toLowerCase()) throw new Error('Binding BE không khớp ledger');
  const rows = [{ role: 'BE', root: be }];
  if (binding.repositories.fe?.pathFromSource) rows.push({ role: 'FE', root: path.resolve(source, binding.repositories.fe.pathFromSource) });
  return rows;
}

async function diffForRepository(repo, paths, since) {
  const scopes = paths.filter((value) => !value.startsWith('.starciwork/'));
  if (!scopes.length) return [];
  const specs = scopes.map((value) => `:(literal)${value}`);
  const base = ['--no-ext-diff', '--no-color', '--no-renames'];
  const [unstaged, staged, untracked] = await Promise.all([
    git(repo.root, ['diff', ...base, '--name-only', '-z', '--', ...specs]),
    git(repo.root, ['diff', '--cached', ...base, '--name-only', '-z', '--', ...specs]),
    git(repo.root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...specs]),
  ]);
  const sections = [];
  for (const [kind, names, stagedFlag] of [['working', nulList(unstaged), false], ['staged', nulList(staged), true]]) {
    const files = [...new Set(names)].filter(codePath).slice(0, 40);
    if (!files.length) continue;
    const patch = await git(repo.root, ['diff', ...(stagedFlag ? ['--cached'] : []), ...base, '--unified=3', '--', ...files.map((file) => `:(literal)${file}`)], 6 * 1024 * 1024);
    if (patch) sections.push({ repository: repo.role, kind, files, patch: sanitizePatch(patch), truncated: patch.length > 120_000 });
  }
  const newFiles = [...new Set(nulList(untracked))].filter(codePath).slice(0, 20);
  if (newFiles.length) {
    const chunks = [];
    for (const file of newFiles) {
      const absolute = path.resolve(repo.root, file);
      if (!inside(repo.root, absolute)) continue;
      const info = await lstat(absolute).catch(() => null);
      if (!info?.isFile() || info.size > 32_000) continue;
      const content = await readFile(absolute, 'utf8');
      if (content.includes('\0')) continue;
      const lines = content.split(/\r?\n/).slice(0, 240);
      chunks.push(`diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join('\n')}`);
    }
    if (chunks.length) sections.push({ repository: repo.role, kind: 'untracked', files: newFiles, patch: sanitizePatch(chunks.join('\n')), truncated: chunks.join('\n').length > 120_000 });
  }
  const sinceDate = Number.isFinite(Number(since)) ? new Date(Number(since)).toISOString() : null;
  if (sinceDate) {
    const committedNames = await git(repo.root, ['log', `--since=${sinceDate}`, '--max-count=3', '--name-only', '--pretty=format:', '--', ...specs]);
    const committedFiles = [...new Set(committedNames.split(/\r?\n/).filter(codePath))].slice(0, 40);
    if (committedFiles.length) {
      const patch = await git(repo.root, ['log', `--since=${sinceDate}`, '--max-count=3', '--format=commit %h · %ad · %s', '--date=iso-strict', '-p', ...base, '--', ...committedFiles.map((file) => `:(literal)${file}`)], 6 * 1024 * 1024);
      if (patch) sections.push({ repository: repo.role, kind: 'committed', files: committedFiles, patch: sanitizePatch(patch), truncated: patch.length > 120_000 });
    }
  }
  return sections;
}

async function imagesIn(repo, paths) {
  const found = [];
  let visited = 0;
  const walk = async (absolute, depth) => {
    if (visited++ > 500 || depth > 6 || !inside(repo.root, absolute)) return;
    const info = await lstat(absolute).catch(() => null);
    if (!info || info.isSymbolicLink()) return;
    if (info.isDirectory()) {
      for (const entry of await readdir(absolute, { withFileTypes: true }).catch(() => [])) {
        if (visited > 500) break;
        await walk(path.join(absolute, entry.name), depth + 1);
      }
      return;
    }
    if (!info.isFile() || info.size > 20 * 1024 * 1024 || !imageTypes[path.extname(absolute).toLowerCase()]) return;
    const real = await realpath(absolute).catch(() => null);
    if (!real || !inside(repo.root, real)) return;
    const relative = path.relative(repo.root, absolute).replaceAll('\\', '/');
    found.push({ id: createHash('sha256').update(`${repo.role}:${relative}`).digest('hex').slice(0, 20), repository: repo.role,
      name: path.basename(relative), path: relative, modifiedAt: info.mtimeMs, size: info.size, absolute, mime: imageTypes[path.extname(absolute).toLowerCase()] });
  };
  for (const value of paths) {
    const absolute = path.resolve(repo.root, value);
    if (inside(repo.root, absolute)) await walk(absolute, 0);
  }
  return found;
}

async function imagesForRepositories(repos, paths) {
  const images = (await Promise.all(repos.map((repo) => imagesIn(repo, paths)))).flat();
  return [...new Map(images.map((image) => [image.id, image])).values()].sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 12);
}

/**
 * The op's own worktree against its base: committed (base..HEAD), staged, working and untracked code files. The
 * worktree belongs to this op alone, so the whole tree is its diff (no owned-path filter). The base is the record's
 * baseSha (the workflow branch tip the op branched from), else the merge-base of HEAD with the workflow branch.
 * {sections, base, head}.
 */
export async function diffForWorktree(role, dir, record) {
  const base = ['--no-ext-diff', '--no-color', '--no-renames'];
  const head = (await git(dir, ['rev-parse', 'HEAD'])).trim();
  let baseSha = /^[0-9a-f]{40}$/.test(record.baseSha ?? '') ? record.baseSha : null;
  if (!baseSha) baseSha = (await git(dir, ['merge-base', 'HEAD', record.workflow.branch]).catch(() => '')).trim() || null;
  const sections = [];
  const section = async (kind, nameArgs, patchArgs) => {
    const files = [...new Set(nulList(await git(dir, [...nameArgs, '-z'])))].filter(codePath).slice(0, 40);
    if (!files.length) return;
    const patch = await git(dir, [...patchArgs, '--', ...files.map((file) => `:(literal)${file}`)], 6 * 1024 * 1024);
    if (patch) sections.push({ repository: role, kind, files, patch: sanitizePatch(patch), truncated: patch.length > 120_000 });
  };
  if (baseSha && baseSha !== head) await section('committed', ['diff', ...base, '--name-only', baseSha, 'HEAD'], ['diff', ...base, '--unified=3', baseSha, 'HEAD']);
  await section('staged', ['diff', '--cached', ...base, '--name-only'], ['diff', '--cached', ...base, '--unified=3']);
  await section('working', ['diff', ...base, '--name-only'], ['diff', ...base, '--unified=3']);
  const newFiles = [...new Set(nulList(await git(dir, ['ls-files', '--others', '--exclude-standard', '-z'])))].filter(codePath).slice(0, 20);
  const chunks = [];
  for (const file of newFiles) {
    const absolute = path.resolve(dir, file);
    if (!inside(dir, absolute)) continue;
    const info = await lstat(absolute).catch(() => null);
    if (!info?.isFile() || info.size > 32_000) continue;
    const content = await readFile(absolute, 'utf8');
    if (content.includes('\0')) continue;
    const lines = content.split(/\r?\n/).slice(0, 240);
    chunks.push(`diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join('\n')}`);
  }
  if (chunks.length) sections.push({ repository: role, kind: 'untracked', files: newFiles, patch: sanitizePatch(chunks.join('\n')), truncated: chunks.join('\n').length > 120_000 });
  return { sections, base: baseSha, head };
}

const SHARED_NOTE = 'Diff giới hạn trong đường dẫn được giao cho op; có cả thay đổi chưa commit và tối đa 3 commit gần nhất từ khi op bắt đầu. Checkout có thể được nhiều agent dùng chung nên chưa thể quy từng dòng cho một agent.';

/**
 * A LIVE op's changes. An isolated op (payload.productWorktree) is diffed in its own worktree against its base
 * (`source: 'op-worktree'`); a record whose worktree is gone answers `worktree-missing` with no patches, never the
 * main checkout's diff. An op without a record keeps the shared-tree diff of its owned paths (`shared-tree`).
 * Images are the owned paths' images in the bound repositories either way.
 */
export async function readAgentChanges(project, jobId) {
  const { paths, since, worktree: record } = activeJob(project, jobId);
  const repos = await repositories(project);
  const images = (await imagesForRepositories(repos, paths)).map(({ absolute, mime, ...image }) => image);
  const out = { jobId, updatedAt: Date.now(), images };
  if (!record) {
    const patches = (await Promise.all(repos.map((repo) => diffForRepository(repo, paths, since)))).flat();
    return { ...out, source: 'shared-tree', worktree: null, patches, note: SHARED_NOTE };
  }
  const repo = repos.find((item) => path.resolve(item.root).toLowerCase() === path.resolve(record.repoRoot).toLowerCase()) ?? null;
  const dir = path.resolve(record.op.path);
  const view = { repository: repo?.role ?? null, path: repo && inside(repo.root, dir) ? path.relative(repo.root, dir).replaceAll('\\', '/') : path.basename(dir),
    branch: record.op.branch ?? null, workflowBranch: record.workflow.branch ?? null, base: null, head: null };
  const exists = Boolean(repo && inside(repo.root, dir) && (await lstat(dir).catch(() => null))?.isDirectory());
  if (!exists) return { ...out, source: 'worktree-missing', worktree: view, patches: [], note: 'Op được giao worktree riêng nhưng worktree không còn trên đĩa (hoặc không thuộc repository đã bind): không có diff live; diff đã settle xem ở /api/diff.' };
  const diff = await diffForWorktree(repo.role, dir, record);
  return { ...out, source: 'op-worktree', worktree: { ...view, base: diff.base, head: diff.head }, patches: diff.sections,
    note: `Diff trong worktree riêng của op (${view.branch ?? 'op branch'}) so với base ${diff.base ? diff.base.slice(0, 12) : 'không xác định'}: commit của op, thay đổi staged, chưa commit và file mới.` };
}

export async function readAgentImage(project, jobId, imageId) {
  if (!/^[a-f0-9]{20}$/.test(imageId)) throw new Error('Ảnh không hợp lệ');
  const { paths } = activeJob(project, jobId);
  const repos = await repositories(project);
  const image = (await imagesForRepositories(repos, paths)).find((item) => item.id === imageId);
  if (!image) throw new Error('Không tìm thấy ảnh trong phạm vi op');
  return { body: await readFile(image.absolute), mime: image.mime };
}

export async function readProjectHistory(project) {
  const repos = await repositories(project);
  const lists = await Promise.all(repos.map(async (repo) => {
    const output = await git(repo.root, ['log', '-n', '100', '--format=@@@%H%x09%ct%x09%s', '--name-only'], 2 * 1024 * 1024);
    return output.split('@@@').slice(1).map((block) => {
      const [head, ...names] = block.trim().split(/\r?\n/);
      const [sha, seconds, ...subject] = head.split('\t');
      return { sha, repository: repo.role, at: Number(seconds) * 1000, subject: redactLogLine(subject.join(' '), 180), hasCode: names.some((name) => codePath(name.trim())) };
    }).filter((item) => /^[a-f0-9]{40}$/.test(item.sha) && item.hasCode).slice(0, 18)
      .map(({ hasCode, ...item }) => item);
  }));
  return lists.flat().sort((a, b) => b.at - a.at).slice(0, 30);
}

export async function readProjectCommit(project, role, sha) {
  if (!['BE', 'FE'].includes(role) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Commit không hợp lệ');
  const repo = (await repositories(project)).find((item) => item.role === role);
  if (!repo) throw new Error('Không tìm thấy repository');
  const names = await git(repo.root, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha]);
  const files = names.split(/\r?\n/).filter(codePath).slice(0, 40);
  if (!files.length) return { repository: role, sha, files: [], patch: '', truncated: false };
  const patch = await git(repo.root, ['show', '--format=commit %h · %ad · %s', '--date=iso-strict', '--no-ext-diff', '--no-color', '--no-renames', '--unified=3', sha, '--', ...files.map((file) => `:(literal)${file}`)], 6 * 1024 * 1024);
  return { repository: role, sha, files, patch: sanitizePatch(patch), truncated: patch.length > 120_000 };
}
