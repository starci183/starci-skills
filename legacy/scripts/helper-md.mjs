// helper.md is the one authored file of a helper, and this module is the one place it is parsed, so
// validate-helper, generate-helpers-index and generate-helper-briefs cannot disagree about which
// table says what. A helper is support work beside the operators: it opens no session, writes no
// product source, touches no runtime and publishes nothing, so its file carries Reads and Writes
// where an operator.md carries Context, Inputs and Next — there is no chain to hand to.
// Tables are read by position, so the English file and its Vietnamese mirror parse identically.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseSectioned } from './operator-md.mjs';

export const HELPER_HEADINGS = {
  en: { job: '## Job', doneWhen: '## Done when', reads: '## Reads', writes: '## Writes', requirements: '## Requirements', steps: '## Steps', outputs: '## Outputs', stops: '## Stops' },
  vi: { job: '## Việc', doneWhen: '## Xong khi', reads: '## Đọc', writes: '## Ghi', requirements: '## Yêu cầu', steps: '## Các bước', outputs: '## Đầu ra', stops: '## Dừng' },
};
export const HELPER_COLUMNS = {
  reads: ['alias', 'bind', 'required'],
  writes: ['alias', 'what'],
  requirements: ['field', 'type', 'default', 'ask'],
  steps: ['n', 'step', 'params', 'reads', 'writes', 'stops'],
  outputs: ['kind', 'file', 'type', 'required'],
  stops: ['code', 'disposition'],
};
export const HELPER_TABLES = Object.keys(HELPER_COLUMNS);

export const parseHelperMd = (text, lang = 'en') => parseSectioned(text, lang, HELPER_HEADINGS, HELPER_COLUMNS);

// An Outputs file of a helper is a path under one of its Writes aliases, because a helper has no
// branch to write a response into; this is the one place that path is split into its alias and rest.
export const writeAliasOf = (file) => {
  const m = /^(@[a-z][a-z-]*(?:\/[a-z_][a-z0-9_-]*)*)(?:\/(.*))?$/.exec(String(file ?? '').trim());
  return m ? { alias: m[1], rest: m[2] ?? '' } : null;
};

export async function loadHelperPackages(root) {
  const { readdir } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const dir = path.join(root, 'helpers');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    const manifest = JSON.parse(await readFile(path.join(full, 'helper.json'), 'utf8'));
    const mdPath = path.join(full, 'helper.md');
    const en = existsSync(mdPath) ? parseHelperMd(await readFile(mdPath, 'utf8'), 'en') : null;
    const viPath = path.join(full, 'helper.vi.md');
    const vi = existsSync(viPath) ? parseHelperMd(await readFile(viPath, 'utf8'), 'vi') : null;
    out.push({ dir: full, name: entry.name, manifest, en, vi });
  }
  return out;
}
