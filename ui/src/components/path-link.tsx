import { useState } from 'react';
import { File, Folder } from 'lucide-react';
import { Link } from '@heroui/react';
import { Button } from './ui/button';
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
    <Link className="path-main" href={`vscode://file/${toUrlPath(path)}`} aria-label={`${t('Open in VS Code on the host')}: ${label ?? path}`}><Link.Icon><Icon className="size-3.5 shrink-0" aria-hidden="true" /></Link.Icon><span title={t('Open in VS Code on the host')}>{label ?? path}</span></Link>
    <Link className="path-action" href={`cursor://file/${toUrlPath(path)}`} aria-label={`${t('Open in Cursor')}: ${path}`}><span title={t('Open in Cursor')}>Cursor</span></Link>
    {kind === 'file' ? <Link className="path-action" href={`vscode://file/${toUrlPath(parentOf(path))}`} aria-label={`${t('Open the containing folder')}: ${parentOf(path)}`}><span title={t('Open the containing folder')}>{t('folder')}</span></Link> : null}
    <Button variant="ghost" size="xs" type="button" className="path-action" onClick={copy} title={t('Copy path')}>{copied ? t('Copied') : t('Copy')}</Button>
  </span>;
}
