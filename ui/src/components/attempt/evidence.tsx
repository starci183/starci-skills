import { useState } from 'react';
import { FileCode2, Film, Image as ImageIcon } from 'lucide-react';
import type { BlobLink, MediaItem } from '../../contract';
import { ConceptBlock, type Concept } from '../concept';

export const concept: Concept = 'C11';
type DiffLine = { t: ' ' | '+' | '-'; o?: number; n?: number; s: string };
type DiffFile = { path: string; status: string; added: number; removed: number; binary: boolean; image: boolean; hunks: { header: string; lines: DiffLine[] }[]; before?: BlobLink; after?: BlobLink };
export type JobDiff = { files: DiffFile[]; baseSha?: string | null; headSha?: string | null };

export function DiffView({ diff }: { diff: JobDiff | null }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!diff?.files?.length) return <p className="text-sm text-muted-foreground">Chưa có diff được ghi nhận.</p>;
  const file = diff.files.find(item => item.path === selected) ?? diff.files[0];
  return <ConceptBlock concept="C11" className="grid min-w-0 gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
    <div className="min-w-0 space-y-1">{diff.files.map(item => <button key={item.path} type="button" onClick={() => setSelected(item.path)} className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-muted ${file.path === item.path ? 'bg-muted' : ''}`}><FileCode2 className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate" title={item.path}>{item.path}</span><span className="text-muted-foreground">+{item.added} −{item.removed}</span></button>)}</div>
    <div className="min-w-0 overflow-hidden rounded-lg border"><div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium break-all">{file.status} · {file.path}</div>
      {file.image ? <div className="grid gap-3 p-3 sm:grid-cols-2">{([['Trước', file.before], ['Sau', file.after]] as const).map(([label, side]) => <figure key={label}><figcaption className="mb-2 text-xs text-muted-foreground">{label}</figcaption>{side ? <a href={side.href} target="_blank" rel="noreferrer"><img className="max-h-72 w-full rounded border object-contain" src={side.href} alt={`${label} ${file.path}`} /></a> : <div className="rounded border p-4 text-xs text-muted-foreground">Không có ảnh</div>}</figure>)}</div> : file.binary ? <p className="p-3 text-xs text-muted-foreground">Tệp nhị phân.</p> : <div className="max-h-96 overflow-auto font-mono text-xs">{file.hunks.map((hunk, index) => <div key={index}><div className="sticky top-0 bg-muted px-3 py-1 text-muted-foreground">{hunk.header}</div>{hunk.lines.map((line, lineIndex) => <div key={lineIndex} className={`min-w-max whitespace-pre px-3 py-0.5 ${line.t === '+' ? 'bg-[var(--status-success-bg)]' : line.t === '-' ? 'bg-[var(--status-failed-bg)]' : ''}`}><span className="mr-3 text-muted-foreground">{line.o ?? ''} {line.n ?? ''}</span>{line.t}{line.s}</div>)}</div>)}</div>}
    </div>
  </ConceptBlock>;
}

export function MediaGrid({ items }: { items: MediaItem[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Chưa có media.</p>;
  return <ConceptBlock concept="C11" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => {
    const type = item.blob.mediaType;
    return <figure key={item.artifactId} className="min-w-0 overflow-hidden rounded-xl border bg-card"><div className="flex aspect-video items-center justify-center overflow-hidden bg-muted/30">{type.startsWith('image/') ? <a href={item.blob.href} target="_blank" rel="noreferrer"><img src={item.blob.href} alt={item.label ?? item.name} loading="lazy" className="max-h-full max-w-full object-contain" /></a> : type.startsWith('video/') ? <video controls preload="metadata" className="h-full w-full" src={item.blob.href} aria-label={item.label ?? item.name} /> : type.startsWith('audio/') ? <audio controls preload="metadata" src={item.blob.href} aria-label={item.label ?? item.name} /> : type.includes('pdf') ? <FileCode2 className="size-8 text-muted-foreground" /> : <Film className="size-8 text-muted-foreground" />}</div><figcaption className="flex min-w-0 items-center gap-2 p-3 text-xs"><ImageIcon className="size-3.5 shrink-0 text-muted-foreground" /><a href={item.blob.href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">{item.label ?? item.name}</a><span className="text-muted-foreground">{item.role}</span></figcaption></figure>;
  })}</ConceptBlock>;
}
