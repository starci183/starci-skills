import type { AttemptDetailV3, AttemptManifest, EvidenceFile } from '../../../contract';
import { useBlobText } from '../../evidence/use-blob-text';

const scalar = (raw: string): string => raw.trim().replace(/^(['"])(.*)\1$/, '$2');
const outcomeOf = (value: string): string => (/^(true|pass|passed|ok)$/i.test(value) ? 'pass' : /^(false|fail|failed)$/i.test(value) ? 'fail' : value);

/**
 * Small reader for `starci/evidence@1` manifests, used only when the server did not send `attempt.manifest`.
 * Understands the two shapes seen in the ledger: assertions with `passed: bool` or `outcome: pass|fail`,
 * assets as plain paths or `{path, role}`, and folded multi-line `detail`.
 */
export function parseManifestYaml(text: string): AttemptManifest | null {
  const lines = text.replaceAll('\r', '').split('\n');
  const top: Record<string, string[]> = {};
  let key: string | null = null;
  const head: Record<string, string> = {};
  for (const line of lines) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m) { key = m[1]; head[key] = m[2]; top[key] = []; continue; }
    if (key && line.trim()) top[key].push(line);
  }
  if (!Object.keys(head).length) return null;
  const items = (rows: string[]): { indent: number; rows: string[] }[] => {
    const out: { indent: number; rows: string[] }[] = [];
    for (const row of rows) {
      const dash = /^(\s*)-(?:\s+(.*))?$/.exec(row);
      if (dash && (!out.length || dash[1].length <= out.at(-1)!.indent - 2)) out.push({ indent: dash[1].length + 2, rows: [dash[2] ?? ''] });
      else if (out.length) out.at(-1)!.rows.push(row);
    }
    return out;
  };
  const record = (block: { indent: number; rows: string[] }): Record<string, string> => {
    const rec: Record<string, string> = {}; let last = '';
    block.rows.forEach((row, i) => {
      const at = i === 0 ? block.indent : row.length - row.trimStart().length;
      const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(row.trim());
      if (m && at <= block.indent) { last = m[1]; rec[last] = scalar(m[2]); } else if (last) rec[last] = `${rec[last]} ${scalar(row)}`.trim();
    });
    return rec;
  };
  const assertions = items(top.assertions ?? []).map(block => {
    const rec = record(block);
    const outcome = rec.outcome ? outcomeOf(rec.outcome) : rec.passed ? outcomeOf(rec.passed) : 'unknown';
    return { id: rec.id ?? '—', outcome, ...(rec.detail ? { detail: rec.detail } : {}) };
  });
  const assets = items(top.assets ?? []).map(block => record(block).path ?? scalar(block.rows[0]));
  return { outcome: head.outcome ? scalar(head.outcome) : null, assertions, assets, provenance: null };
}

export const isManifestFile = (file: EvidenceFile) => /(^|\/)manifest\.ya?ml$/i.test(file.name);

/** The server's manifest, or (older server) the manifest.yaml attachment parsed here. */
export function useManifest(attempt: AttemptDetailV3): AttemptManifest | null {
  const file = Object.hasOwn(attempt, 'manifest') ? null : attempt.files.find(file => /^attachments\/(evidence|E)\/manifest\.ya?ml$/i.test(file.name)) ?? null;
  const blob = useBlobText(file);
  if (attempt.manifest) return attempt.manifest;
  if (blob.status === 'ready') return parseManifestYaml(blob.text);
  return null;
}
