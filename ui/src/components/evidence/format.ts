import type { EvidenceFile } from '../../contract';
import { t } from '../../i18n/t';

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
/** Renders a byte count as B, KB or MB in the viewer's locale, for file sizes in the evidence list and headers. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${nf.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${nf.format(bytes / 1024)} KB`;
  return `${nf.format(bytes / 1024 / 1024)} MB`;
};

/** Short display names for the non-UTF-8 encodings an evidence file can declare. */
export const encodingLabels: Record<string, string> = { 'utf-16le': 'UTF-16 LE', 'utf-16be': 'UTF-16 BE', 'utf-8-bom': 'UTF-8 BOM' };
/** Explains how the server decoded a non-UTF-8 evidence file, shown beside its title. */
export const encodingNotes: Record<string, string> = {
  'utf-16le': t('UTF-16 LE with BOM → decoded'),
  'utf-16be': t('UTF-16 BE → decoded'),
  'utf-8-bom': t('UTF-8 with BOM → BOM stripped'),
};
/** True when a file needs no encoding callout: undeclared or plain UTF-8. */
export const isPlainEncoding = (encoding: EvidenceFile['encoding']) => encoding == null || encoding === 'utf-8';
/** Trims a sha256 digest to the twelve characters people compare by eye. */
export const shortSha = (sha: string) => sha.replace(/^sha256:/, '').slice(0, 12);
