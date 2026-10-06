import { useState } from 'react';
import { File, Folder } from 'lucide-react';
import type { Concept } from './concept';
import { t } from '../i18n/t';

export const concept: Concept = 'frame';

const toUrlPath = (value: string) => encodeURI(value.replaceAll('\\', '/'));
const parentOf = (value: string) => value.replace(/[\\/][^\\/]*$/, '');

/**
 * A host path the owner can open: the chip opens it in VS Code (vscode://file/…), with Cursor,
 * containing-folder (files) and copy actions. The handlers open on the viewer's own machine.
 */
export function PathLink({ path, kind = 'dir', label }: { readonly path: string | null | undefined; readonly kind?: 'dir' | 'file'; readonly label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!path) return <span className="text-muted-foreground">—</span>;
  const Icon = kind === 'file' ? File : Folder;
  const copy = () => {
    void navigator.clipboard?.writeText(path).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }, () => undefined);
  };
  return <span className="path-link">
    <a className="path-main" href={`vscode://file/${toUrlPath(path)}`} title={t('Open in VS Code on the host')}><Icon className="size-3.5 shrink-0" aria-hidden="true" />{label ?? path}</a>
    <a className="path-action" href={`cursor://file/${toUrlPath(path)}`} title={t('Open in Cursor')}>Cursor</a>
    {kind === 'file' ? <a className="path-action" href={`vscode://file/${toUrlPath(parentOf(path))}`} title={t('Open the containing folder')}>{t('folder')}</a> : null}
    <button type="button" className="path-action" onClick={copy} title={t('Copy path')}>{copied ? t('Copied') : t('Copy')}</button>
  </span>;
}
