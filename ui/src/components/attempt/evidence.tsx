import { useState } from 'react';
import { Card, Link } from '@heroui/react';
import { FileCode2, Film, Image as ImageIcon } from 'lucide-react';
import type { BlobLink, MediaItem } from '../../contract';
import { ConceptBlock, type Concept } from '../concept';
import { t } from '../../i18n/t';
import { Button } from '../ui/button';
import { FeedbackState } from '../feedback-state';
import { MediaImage } from '../ui/media-image';

/** The business concept id (C11) under which the diff and media evidence views is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C11';
type DiffLine = { t: ' ' | '+' | '-'; o?: number; n?: number; s: string };
type DiffFile = { path: string; status: string; added: number; removed: number; binary: boolean; image: boolean; hunks: { header: string; lines: DiffLine[] }[]; before?: BlobLink; after?: BlobLink };
/** The job diff the evidence view renders: the changed files with their hunks, plus the base and head commits it was taken between. */
export type JobDiff = { files: DiffFile[]; baseSha?: string | null; headSha?: string | null };

const lineBackground: Record<DiffLine['t'], string> = { '+': 'bg-[var(--status-success-bg)]', '-': 'bg-[var(--status-failed-bg)]', ' ': '' };

const lineKey = (line: DiffLine) => `${line.t}:${line.o ?? ''}:${line.n ?? ''}`;

const ImageSides = ({ file }: Readonly<{ file: DiffFile }>) => {
  return <div className="grid gap-3 p-3 sm:grid-cols-2">{([[t('Before'), file.before], [t('After'), file.after]] as const).map(([label, side]) => <figure key={label}><figcaption className="mb-2 text-xs text-muted-foreground">{label}</figcaption>{side ? <Link href={side.href} target="_blank" rel="noreferrer" className="block"><MediaImage frameClassName="w-full" className="max-h-72 w-full rounded border object-contain" src={side.href} alt={`${label} ${file.path}`} /></Link> : <FeedbackState>{t('No image')}</FeedbackState>}</figure>)}</div>;
};

const HunkList = ({ file }: Readonly<{ file: DiffFile }>) => {
  return <div className="max-h-96 overflow-auto font-mono text-xs">{file.hunks.map(hunk => <div key={hunk.header}><div className="sticky top-0 bg-default px-3 py-1 text-muted-foreground">{hunk.header}</div>{hunk.lines.map(line => <div key={lineKey(line)} className={`min-w-max whitespace-pre px-3 py-0.5 ${lineBackground[line.t]}`}><span className="mr-3 text-muted-foreground">{line.o ?? ''} {line.n ?? ''}</span>{line.t}{line.s}</div>)}</div>)}</div>;
};

const DiffBody = ({ file }: Readonly<{ file: DiffFile }>) => {
  if (file.image) return <ImageSides file={file} />;
  if (file.binary) return <p className="p-3 text-xs text-muted-foreground">{t('Binary file.')}</p>;
  return <HunkList file={file} />;
};

/** Browsable file-by-file diff of one job, with side-by-side previews for images and a fallback for binaries. */
export const DiffView = ({ diff }: Readonly<{ diff: JobDiff | null }>) => {
  const [selected, setSelected] = useState<string | null>(null);
  const file = diff?.files?.find(item => item.path === selected) ?? diff?.files?.[0];
  if (!diff || !file) return <FeedbackState>{t('No diff recorded yet.')}</FeedbackState>;
  return <ConceptBlock concept="C11" className="grid min-w-0 gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
    <div className="min-w-0 space-y-2">{diff.files.map(item => <Button key={item.path} type="button" variant="ghost" aria-pressed={file.path === item.path} onClick={() => setSelected(item.path)} className={`h-auto w-full min-w-0 justify-start gap-2 px-3 py-3 text-left text-xs ${file.path === item.path ? 'bg-default' : ''}`}><FileCode2 className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate" title={item.path}>{item.path}</span><span className="text-muted-foreground">+{item.added} −{item.removed}</span></Button>)}</div>
    <Card className={`min-w-0 overflow-hidden gap-0 p-0${!file.image && !file.binary ? ' evidence-code-frame' : ''}`}><Card.Header className="bg-default px-3 py-2"><Card.Title className="break-all text-xs font-medium">{file.status} · {file.path}</Card.Title></Card.Header>
      <Card.Content className="min-w-0 p-0"><DiffBody file={file} /></Card.Content>
    </Card>
  </ConceptBlock>;
};

const MediaPreview = ({ item }: Readonly<{ item: MediaItem }>) => {
  const type = item.blob.mediaType;
  const name = item.label ?? item.name;
  if (type.startsWith('image/')) return <Link href={item.blob.href} target="_blank" rel="noreferrer" className="block"><MediaImage frameClassName="max-h-full max-w-full" src={item.blob.href} alt={name} loading="lazy" className="max-h-full max-w-full object-contain" /></Link>;
  if (type.startsWith('video/')) return <video controls preload="metadata" className="h-full w-full" src={item.blob.href} aria-label={name}><track kind="captions" /></video>;
  if (type.startsWith('audio/')) return <audio controls preload="metadata" src={item.blob.href} aria-label={name}><track kind="captions" /></audio>;
  if (type.includes('pdf')) return <FileCode2 className="size-8 text-muted-foreground" />;
  return <Film className="size-8 text-muted-foreground" />;
};

/** Grid of the media artifacts an attempt produced (screenshots, recordings, audio, documents), each with its label and role. */
export const MediaGrid = ({ items }: Readonly<{ items: MediaItem[] }>) => {
  if (!items.length) return <FeedbackState>{t('No media yet.')}</FeedbackState>;
  return <ConceptBlock concept="C11" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <Card<'figure'> key={item.artifactId} render={props => <figure {...props} />} className="min-w-0 overflow-hidden gap-0 p-0"><Card.Content className="flex aspect-video items-center justify-center overflow-hidden bg-default p-0"><MediaPreview item={item} /></Card.Content><Card.Footer<'figcaption'> render={props => <figcaption {...props} />} className="flex min-w-0 items-center gap-2 p-3 text-xs"><ImageIcon className="size-3.5 shrink-0 text-muted-foreground" /><Link href={item.blob.href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-words text-xs">{item.label ?? item.name}</Link><span className="text-muted-foreground">{item.role}</span></Card.Footer></Card>)}</ConceptBlock>;
};
