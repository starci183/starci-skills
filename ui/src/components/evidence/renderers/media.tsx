import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import { useRef, useState } from 'react';
import { MaximizeIcon } from 'lucide-react';
import type { EvidenceFile } from '../../../contract';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatBytes, Frame, toolbarBtn } from './common';
import { t } from '../../../i18n/t';
import { Button } from '../../ui/button';
import { FeedbackState } from '../../feedback-state';

export function ImageView({ file }: Readonly<{ file: EvidenceFile }>) {
  const [dim, setDim] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState(false);
  const meta = [dim, formatBytes(file.bytes), file.mediaType].filter(Boolean).join(' · ');
  if (failed) return <div data-tone="failed" className="rounded-lg border border-[var(--tone-line)] bg-[var(--tone-bg)] px-3 py-2 text-xs text-[var(--tone)]">{t('Could not load image {name}.', { name: file.name })}</div>;
  return (
    <>
      <Frame className="evidence-media-frame inline-block max-w-full">
        <Button variant="ghost" type="button" onClick={() => setOpen(true)} title={t('Click to enlarge')} className="group relative block h-auto max-w-full rounded-none p-0 bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
          <img src={file.href} alt={file.name} onError={() => setFailed(true)} onLoad={e => setDim(`${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`)} className="max-h-72 max-w-full object-contain" />
          <span className="absolute right-2 top-2 rounded-md bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><MaximizeIcon className="size-3.5" /></span>
        </Button>
        <div className="border-t bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">{meta}</div>
      </Frame>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[95vh] w-[95vw] gap-2 sm:max-w-[95vw]">
          <DialogTitle className="truncate pr-8 text-sm">{file.name}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="xs" type="button" className={toolbarBtn} aria-pressed={!full} onClick={() => setFull(false)}>{t('Fit')}</Button>
            <Button variant="outline" size="xs" type="button" className={toolbarBtn} aria-pressed={full} onClick={() => setFull(true)}>100%</Button>
            <span className="text-[11px] text-muted-foreground">{meta}</span>
          </div>
          <div className="max-h-[78vh] overflow-auto rounded-lg border bg-muted/40">
            <img src={file.href} alt={file.name} className={full ? 'max-w-none' : 'mx-auto max-h-[76vh] max-w-full object-contain'} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const SPEEDS = [0.5, 1, 1.5, 2];

export function VideoView({ file }: Readonly<{ file: EvidenceFile }>) {
  const ref = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const [info, setInfo] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const setRate = (r: number) => { setSpeed(r); if (ref.current) ref.current.playbackRate = r; };
  return (
    <Frame className="evidence-media-frame max-w-full">
      {failed ? <FeedbackState error>{t('Could not load video {name}.', { name: file.name })}</FeedbackState> : null}
      {/* #t=0.1 makes the browser paint the first frame as the poster */}
      <video ref={ref} src={`${file.href}#t=0.1`} controls preload="metadata" playsInline className="max-h-[70vh] w-full bg-muted/40"
        aria-label={file.name} onError={() => setFailed(true)}
        onLoadedMetadata={e => { const v = e.currentTarget; setFailed(false); setInfo([`${v.videoWidth}×${v.videoHeight}`, Number.isFinite(v.duration) ? t('{n} sec', { n: Math.round(v.duration) }) : null].filter(Boolean).join(' · ')); }}><track kind="captions" /></video>
      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
        <span>{t('Speed')}</span>
        {SPEEDS.map(r => <Button variant="outline" size="xs" key={r} type="button" className={toolbarBtn} disabled={failed} aria-pressed={speed === r} onClick={() => setRate(r)}>{r}×</Button>)}
        <span className="ml-auto">{[info, formatBytes(file.bytes)].filter(Boolean).join(' · ')}</span>
      </div>
    </Frame>
  );
}
