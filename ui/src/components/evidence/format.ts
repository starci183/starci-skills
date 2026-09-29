import type { EvidenceFile } from '../../contract';

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${nf.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${nf.format(bytes / 1024)} KB`;
  return `${nf.format(bytes / 1024 / 1024)} MB`;
}

export const encodingLabels: Record<string, string> = { 'utf-16le': 'UTF-16 LE', 'utf-16be': 'UTF-16 BE', 'utf-8-bom': 'UTF-8 BOM' };
export const encodingNotes: Record<string, string> = {
  'utf-16le': 'UTF-16 LE có BOM → đã giải mã',
  'utf-16be': 'UTF-16 BE → đã giải mã',
  'utf-8-bom': 'UTF-8 có BOM → đã bỏ BOM',
};
export const isPlainEncoding = (encoding: EvidenceFile['encoding']) => encoding == null || encoding === 'utf-8';
export const shortSha = (sha: string) => sha.replace(/^sha256:/, '').slice(0, 12);
