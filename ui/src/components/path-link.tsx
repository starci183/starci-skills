import { useState } from 'react';
import { File, Folder } from 'lucide-react';
import type { Concept } from './concept';

export const concept: Concept = 'frame';

const toUrlPath = (value: string) => encodeURI(value.replaceAll('\\', '/'));
const parentOf = (value: string) => value.replace(/[\\/][^\\/]*$/, '');

/**
 * A host path the owner can open: the chip opens it in VS Code (vscode://file/…), with Cursor,
 * containing-folder (files) and copy actions. The handlers open on the viewer's own machine.
 */
export function PathLink({ path, kind = 'dir', label }: { path: string | null | undefined; kind?: 'dir' | 'file'; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!path) return <span className="text-muted-foreground">—</span>;
  const Icon = kind === 'file' ? File : Folder;
  const copy = () => {
    void navigator.clipboard?.writeText(path).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }, () => undefined);
  };
  return <span className="path-link">
    <a className="path-main" href={`vscode://file/${toUrlPath(path)}`} title="Mở trong VS Code trên máy chủ"><Icon className="size-3.5 shrink-0" aria-hidden="true" />{label ?? path}</a>
    <a className="path-action" href={`cursor://file/${toUrlPath(path)}`} title="Mở trong Cursor">Cursor</a>
    {kind === 'file' ? <a className="path-action" href={`vscode://file/${toUrlPath(parentOf(path))}`} title="Mở thư mục chứa tệp">thư mục</a> : null}
    <button type="button" className="path-action" onClick={copy} title="Chép đường dẫn">{copied ? 'Đã chép' : 'Chép'}</button>
  </span>;
}
