import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion, Card, Chip, Description, Header, Label, ListBox, type Selection } from '@heroui/react';
import { Star } from 'lucide-react';
import type { EvidenceFile, EvidenceFileV3, EvidenceGroup } from '../../contract';
import type { Concept } from '../concept';
import { FileTypeBadge, StatusChip } from '../status-chip';
import { statusFromCheck, statusFromUi } from '../status';
import { EvidenceViewer } from './evidence-viewer';
import { encodingLabels, formatBytes, isPlainEncoding } from './format';
import { t } from '../../i18n/t';

export { useBlobText } from './use-blob-text';
export const concept: Concept = 'C8';

const GROUPS: { id: EvidenceGroup; title: string; hint: string }[] = [
  { id: 'evidence', title: t('Evidence submitted by the op (`evidence/`)'), hint: t('Files the op wrote itself to prove its result.') },
  { id: 'op-run', title: t('Results of commands the op ran'), hint: t('Output of the commands the op ran while working.') },
  { id: 'check', title: t('Check output'), hint: t('Stdout/stderr of each check, grouped by check name.') },
  { id: 'media', title: t('Images & video'), hint: t('Screenshots and recorded video.') },
  { id: 'diff', title: t('Diff'), hint: t('Source changes made by the attempt.') },
  { id: 'log', title: t('Logs'), hint: t('Terminal and process logs.') },
  { id: 'other', title: t('Other'), hint: t('Files that belong to none of the groups above.') },
];

const UNKNOWN_CHECK = t('(unknown check)');
const checkFailed = (file: EvidenceFile) => file.check?.ui === 'bad' || file.check?.status === 'fail' || file.check?.status === 'error';

/** Default = first failing check output, else first evidence file, else the first file. */
export function defaultEvidence(files: EvidenceFile[]): EvidenceFile | null {
  return files.find(f => f.group === 'check' && checkFailed(f)) ?? files.find(f => f.group === 'evidence') ?? files[0] ?? null;
}

const KEY_BASES = new Set(['manifest.yaml', 'result.md', 'scope-evidence.json', 'work-graph.json', 'report.json']);
const v3 = (file: EvidenceFile) => file as Partial<EvidenceFileV3>;
const isEmpty = (file: EvidenceFile) => v3(file).empty ?? file.bytes === 0;
const isKey = (file: EvidenceFile) => v3(file).key ?? KEY_BASES.has(file.base);
const fileName = (file: EvidenceFile) => file.label ?? file.base;

/** Prefer server dupOf/empty/key; otherwise dedupe by sha and treat 0 bytes as empty. */
export function organise(files: EvidenceFile[]) {
  const byId = new Map(files.map(f => [f.artifactId, f]));
  const firstBySha = new Map<string, EvidenceFile>();
  const dupOf = new Map<number, number>();
  const empty: EvidenceFile[] = [];
  for (const f of files) {
    if (isEmpty(f)) { empty.push(f); continue; }
    const served = v3(f).dupOf;
    if (served != null && byId.has(served)) { dupOf.set(f.artifactId, served); continue; }
    const first = firstBySha.get(f.sha);
    if (first && v3(f).dupOf === undefined) dupOf.set(f.artifactId, first.artifactId);
    else if (!first) firstBySha.set(f.sha, f);
  }
  const also = new Map<number, EvidenceFile[]>();
  for (const [dup, orig] of dupOf) { const list = also.get(orig) ?? []; list.push(byId.get(dup) as EvidenceFile); also.set(orig, list); }
  const visible = files.filter(f => !dupOf.has(f.artifactId) && !isEmpty(f));
  return { visible, empty, also, hidden: dupOf.size };
}
const keyFirst = (list: EvidenceFile[]) => [...list.filter(isKey), ...list.filter(f => !isKey(f))];

function Row({ file, also }: Readonly<{ file: EvidenceFile; also?: EvidenceFile[] }>) {
  return <span className="flex w-full min-w-0 flex-col gap-1 text-left text-sm">
    <span className="flex min-w-0 items-center gap-2">
      <FileTypeBadge kind={file.kind} />
      {isKey(file) ? <Star className="size-3 shrink-0 fill-current text-[var(--status-retry,currentColor)]" aria-label={t('Key file')} /> : null}
      <Label className="min-w-0 flex-1 truncate" title={file.label ?? file.base}>{file.label ?? file.base}</Label>
    </span>
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.bytes)}</span>
      {!isPlainEncoding(file.encoding) ? <Chip size="sm" variant="soft" className="shrink-0"><Chip.Label>{encodingLabels[file.encoding as string] ?? file.encoding}</Chip.Label></Chip> : null}
    </span>
    <Description className="truncate font-mono text-xs" title={file.name}>{file.name}</Description>
    {also?.length ? <Description className="truncate text-xs" title={also.map(fileName).join(', ')}>{t('also: {names}', { names: also.map(fileName).join(', ') })}</Description> : null}
  </span>;
}

function Thumb({ file }: Readonly<{ file: EvidenceFile }>) {
  return <span className="flex min-w-0 flex-col gap-2 text-left">
    <span className="flex aspect-video items-center justify-center overflow-hidden rounded bg-default">
      {file.kind === 'image' ? <img src={file.href} alt={file.name} loading="lazy" className="size-full object-cover" />
        : file.kind === 'video' ? <video src={`${file.href}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
        : <FileTypeBadge kind={file.kind} />}
    </span>
    <span className="flex items-center gap-2"><FileTypeBadge kind={file.kind} /><Label className="min-w-0 truncate text-xs" title={file.name}>{file.label ?? file.base}</Label></span>
  </span>;
}

/** Grouped file tree (left) + type-aware viewer frame (right); stacked on mobile. */
export function EvidenceBrowser({ files, selected, onSelect }: Readonly<{ files: EvidenceFile[]; selected: number | null; onSelect: (artifactId: number) => void }>) {
  const current = useMemo(() => files.find(f => f.artifactId === selected) ?? defaultEvidence(files), [files, selected]);
  const listRef = useRef<HTMLDivElement>(null);
  const org = useMemo(() => organise(files), [files]);
  const [showEmpty, setShowEmpty] = useState(false);
  const groups = useMemo(() => GROUPS.flatMap(group => {
    const rows = keyFirst(org.visible.filter(file => file.group === group.id));
    if (!rows.length) return [];
    if (group.id !== 'check') return [{ id: group.id, title: group.title, hint: group.hint, rows, media: group.id === 'media' }];
    return [...new Set(rows.map(file => file.check?.name ?? UNKNOWN_CHECK))].map(name => ({
      id: `${group.id}:${name}`, title: `${group.title} · ${name}`, hint: group.hint,
      rows: rows.filter(file => (file.check?.name ?? UNKNOWN_CHECK) === name), media: false,
    }));
  }), [org]);
  const select = (keys: Selection) => {
    if (keys === 'all') return;
    const key = keys.values().next().value;
    if (typeof key === 'number') onSelect(key);
  };
  useEffect(() => {
    const box = listRef.current;
    const row = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !row) return;
    // Scroll only inside the tree container, never the window.
    const b = box.getBoundingClientRect(); const r = row.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop += r.top - b.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  }, [current?.artifactId]);

  if (files.length === 0) return <Card><Card.Content className="text-sm text-muted-foreground">{t('This attempt has no evidence files yet.')}</Card.Content></Card>;

  return <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
    <Card className="min-w-0 gap-4 p-4">
      <Card.Header><Card.Title>{t('Evidence files')}</Card.Title></Card.Header>
      <Card.Content ref={listRef} className="max-h-[70vh] min-w-0 overflow-auto">
        <ListBox aria-label={t('Evidence files')} selectionMode="single" selectionBehavior="replace" disallowEmptySelection
          selectedKeys={current && org.visible.some(file => file.artifactId === current.artifactId) ? [current.artifactId] : []} onSelectionChange={select} className="gap-4">
          {groups.map(group => <ListBox.Section key={group.id} id={group.id} aria-label={group.title} className={group.media ? 'grid grid-cols-2 gap-2' : 'space-y-1'}>
            <Header className="col-span-full px-2 pb-2">
              <span className="flex items-center gap-2 text-sm font-semibold">{group.title}<span className="ml-auto text-xs font-normal text-muted-foreground">{group.rows.length}</span></span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{group.hint}</span>
              {group.rows[0]?.check ? <StatusChip status={group.rows[0].check.status ? statusFromCheck(group.rows[0].check.status) : statusFromUi(group.rows[0].check.ui)} /> : null}
            </Header>
            {group.rows.map(file => <ListBox.Item key={file.artifactId} id={file.artifactId} textValue={file.label ?? file.base} className="min-h-12 min-w-0 p-3 data-[selected=true]:bg-default">
              {group.media ? <Thumb file={file} /> : <Row file={file} also={org.also.get(file.artifactId)} />}
              <ListBox.ItemIndicator />
            </ListBox.Item>)}
          </ListBox.Section>)}
        </ListBox>
        {org.empty.length ? <Accordion hideSeparator expandedKeys={showEmpty ? ['empty'] : []} onExpandedChange={keys => setShowEmpty(keys.has('empty'))}>
          <Accordion.Item id="empty">
            <Accordion.Heading><Accordion.Trigger className="px-2 text-sm">{showEmpty ? t('{n} empty files · hide', { n: org.empty.length }) : t('{n} empty files · view', { n: org.empty.length })}<Accordion.Indicator /></Accordion.Trigger></Accordion.Heading>
            <Accordion.Panel><Accordion.Body className="px-0 pb-0">
              {showEmpty ? <ListBox aria-label={t('Empty files')} selectionMode="single" selectionBehavior="replace" disallowEmptySelection
                selectedKeys={current && org.empty.some(file => file.artifactId === current.artifactId) ? [current.artifactId] : []} onSelectionChange={select}>
                {org.empty.map(file => <ListBox.Item key={file.artifactId} id={file.artifactId} textValue={file.label ?? file.base} className="min-h-12 min-w-0 py-3 data-[selected=true]:bg-default"><Row file={file} /><ListBox.ItemIndicator /></ListBox.Item>)}
              </ListBox> : null}
            </Accordion.Body></Accordion.Panel>
          </Accordion.Item>
        </Accordion> : null}
      </Card.Content>
    </Card>
    {current ? <EvidenceViewer key={current.artifactId} file={current} /> : null}
  </div>;
}
