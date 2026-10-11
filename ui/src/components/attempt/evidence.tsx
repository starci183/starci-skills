import { useState } from 'react';
import { Card, Link } from '@heroui/react';
import { FileCode2, Film, Image as ImageIcon } from 'lucide-react';
import type { BlobLink, MediaItem } from '../../contract';
import { ConceptBlock, type Concept } from '../concept';
import { t } from '../../i18n/t';
import { Button } from '../ui/button';
import { FeedbackState } from '../feedback-state';

export const concept: Concept = 'C11';
type DiffLine = { t: ' ' | '+' | '-'; o?: number; n?: number; s: string };
type DiffFile = { path: string; status: string; added: number; removed: number; binary: boolean; image: boolean; hunks: { header: string; lines: DiffLine[] }[]; before?: BlobLink; after?: BlobLink };
export type JobDiff = { files: DiffFile[]; baseSha?: string | null; headSha?: string | null };

export function DiffView({ diff }: Readonly<{ diff: JobDiff | null }>) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!diff?.files?.length) return <FeedbackState>{t('No diff recorded yet.')}</FeedbackState>;
  const file = diff.files.find(item => item.path === selected) ?? diff.files[0];
  return <ConceptBlock concept="C11" className="grid min-w-0 gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
    <div className="min-w-0 space-y-2">{diff.files.map(item => <Button key={item.path} type="button" variant="ghost" aria-pressed={file.path === item.path} onClick={() => setSelected(item.path)} className={`h-auto w-full min-w-0 justify-start gap-2 px-3 py-3 text-left text-xs ${file.path === item.path ? 'bg-default' : ''}`}><FileCode2 className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate" title={item.path}>{item.path}</span><span className="text-muted-foreground">+{item.added} −{item.removed}</span></Button>)}</div>
    <Card className={`min-w-0 overflow-hidden gap-0 p-0${!file.image && !file.binary ? ' evidence-code-frame' : ''}`}><Card.Header className="bg-default px-3 py-2"><Card.Title className="break-all text-xs font-medium">{file.status} · {file.path}</Card.Title></Card.Header>
      <Card.Content className="min-w-0 p-0">{file.image ? <div className="grid gap-3 p-3 sm:grid-cols-2">{([[t('Before'), file.before], [t('After'), file.after]] as const).map(([label, side]) => <figure key={label}><figcaption className="mb-2 text-xs text-muted-foreground">{label}</figcaption>{side ? <Link href={side.href} target="_blank" rel="noreferrer" className="block"><img className="max-h-72 w-full rounded border object-contain" src={side.href} alt={`${label} ${file.path}`} /></Link> : <FeedbackState>{t('No image')}</FeedbackState>}</figure>)}</div> : file.binary ? <p className="p-3 text-xs text-muted-foreground">{t('Binary file.')}</p> : <div className="max-h-96 overflow-auto font-mono text-xs">{file.hunks.map((hunk, index) => <div key={`${hunk.header}-${index}`}><div className="sticky top-0 bg-default px-3 py-1 text-muted-foreground">{hunk.header}</div>{hunk.lines.map((line, lineIndex) => <div key={`${line.o ?? ''}-${line.n ?? ''}-${lineIndex}`} className={`min-w-max whitespace-pre px-3 py-0.5 ${line.t === '+' ? 'bg-[var(--status-success-bg)]' : line.t === '-' ? 'bg-[var(--status-failed-bg)]' : ''}`}><span className="mr-3 text-muted-foreground">{line.o ?? ''} {line.n ?? ''}</span>{line.t}{line.s}</div>)}</div>)}</div>}</Card.Content>
    </Card>
  </ConceptBlock>;
}

export function MediaGrid({ items }: Readonly<{ items: MediaItem[] }>) {
  if (!items.length) return <FeedbackState>{t('No media yet.')}</FeedbackState>;
  return <ConceptBlock concept="C11" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => {
    const type = item.blob.mediaType;
    return <Card<'figure'> key={item.artifactId} render={props => <figure {...props} />} className="min-w-0 overflow-hidden gap-0 p-0"><Card.Content className="flex aspect-video items-center justify-center overflow-hidden bg-default p-0">{type.startsWith('image/') ? <Link href={item.blob.href} target="_blank" rel="noreferrer" className="block"><img src={item.blob.href} alt={item.label ?? item.name} loading="lazy" className="max-h-full max-w-full object-contain" /></Link> : type.startsWith('video/') ? <video controls preload="metadata" className="h-full w-full" src={item.blob.href} aria-label={item.label ?? item.name}><track kind="captions" /></video> : type.startsWith('audio/') ? <audio controls preload="metadata" src={item.blob.href} aria-label={item.label ?? item.name}><track kind="captions" /></audio> : type.includes('pdf') ? <FileCode2 className="size-8 text-muted-foreground" /> : <Film className="size-8 text-muted-foreground" />}</Card.Content><Card.Footer<'figcaption'> render={props => <figcaption {...props} />} className="flex min-w-0 items-center gap-2 p-3 text-xs"><ImageIcon className="size-3.5 shrink-0 text-muted-foreground" /><Link href={item.blob.href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-words text-xs">{item.label ?? item.name}</Link><span className="text-muted-foreground">{item.role}</span></Card.Footer></Card>;
  })}</ConceptBlock>;
}
