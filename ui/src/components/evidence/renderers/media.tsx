import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import { useRef, useState } from 'react';
import { MaximizeIcon } from 'lucide-react';
import type { EvidenceFile } from '../../../contract';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatBytes, Frame, toolbarBtn } from './common';

export function ImageView({ file }: { file: EvidenceFile }) {
  const [dim, setDim] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState(false);
  const meta = [dim, formatBytes(file.bytes), file.mediaType].filter(Boolean).join(' · ');
  if (failed) return <div data-tone="failed" className="rounded-lg border border-[var(--tone-line)] bg-[var(--tone-bg)] px-3 py-2 text-xs text-[var(--tone)]">Không tải được ảnh {file.name}.</div>;
  return (
    <>
      <Frame className="inline-block max-w-full">
        <button type="button" onClick={() => setOpen(true)} title="Bấm để phóng to" className="group relative block max-w-full bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
          <img src={file.href} alt={file.name} onError={() => setFailed(true)} onLoad={e => setDim(`${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`)} className="max-h-72 max-w-full object-contain" />
          <span className="absolute right-2 top-2 rounded-md bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><MaximizeIcon className="size-3.5" /></span>
        </button>
        <div className="border-t bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">{meta}</div>
      </Frame>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[95vh] w-[95vw] gap-2 sm:max-w-[95vw]">
          <DialogTitle className="truncate pr-8 text-sm">{file.name}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={toolbarBtn} aria-pressed={!full} onClick={() => setFull(false)}>Vừa khung</button>
            <button type="button" className={toolbarBtn} aria-pressed={full} onClick={() => setFull(true)}>100%</button>
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

export function VideoView({ file }: { file: EvidenceFile }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const [info, setInfo] = useState<string | null>(null);
  const setRate = (r: number) => { setSpeed(r); if (ref.current) ref.current.playbackRate = r; };
  return (
    <Frame className="max-w-full">
      {/* #t=0.1 makes the browser paint the first frame as the poster */}
      <video ref={ref} src={`${file.href}#t=0.1`} controls preload="metadata" playsInline className="max-h-[70vh] w-full bg-muted/40"
        onLoadedMetadata={e => { const v = e.currentTarget; setInfo(`${v.videoWidth}×${v.videoHeight} · ${Math.round(v.duration)} giây`); }} />
      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
        <span>Tốc độ</span>
        {SPEEDS.map(r => <button key={r} type="button" className={toolbarBtn} aria-pressed={speed === r} onClick={() => setRate(r)}>{r}×</button>)}
        <span className="ml-auto">{[info, formatBytes(file.bytes)].filter(Boolean).join(' · ')}</span>
      </div>
    </Frame>
  );
}
