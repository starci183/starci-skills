import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { AttemptDetailV3, EvidenceFileV3, EvidenceKind } from '../../../contract';
import type { Concept } from '../../concept';
import { Advanced } from '../../motion';
import { EvidenceSchemaView, SCHEMA_LABELS } from '../../evidence/schema/evidence-schema-view';
import { PathLink } from '../../path-link';
import { FileTypeBadge } from '../../status-chip';
import { Card, Empty } from '../frame/card';
import { formatBytes } from '../frame/util';
import { t } from '../../../i18n/t';
import { isManifestFile } from '../result/manifest';
import { ProductRow } from './product-row';
import { useProducts } from './use-products';
import { refreshQuery } from '../../../api/query';
import { FeedbackState } from '../../feedback-state';
import { formatAbsolute } from '../../../i18n/vi';
import { ReadWarning } from '../frame/read-warning';

export const concept: Concept = 'C8';

const short = (sha: string | null) => (sha ? sha.slice(0, 9) : '—');
const TEXTY = new Set<EvidenceKind>(['json', 'yaml', 'markdown', 'text']);

/** Files the server marks `key`; older servers: the `evidence/` group, without the manifest (shown as the checklist above) and without duplicates or empties. */
function keyFiles(attempt: AttemptDetailV3): EvidenceFileV3[] {
  const hasFlag = attempt.files.some(file => file.key === true);
  const seen = new Set<string>();
  const out: EvidenceFileV3[] = [];
  for (const file of attempt.files) {
    const isKey = hasFlag ? file.key : file.group === 'evidence';
    if (!isKey || isManifestFile(file) || file.empty || file.bytes === 0 || !TEXTY.has(file.kind) || seen.has(file.sha)) continue;
    seen.add(file.sha); out.push(file);
  }
  return out;
}

function KeyEvidence({ file, authorOp, defaultOpen }: { file: EvidenceFileV3; authorOp: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `key-${file.artifactId}`;
  return <li className="min-w-0 py-2 first:pt-0 last:pb-0">
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" title={open ? t('Collapse') : t('Open')}>
        <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
      </button>
      <span className="min-w-0 flex-1 break-all text-sm font-medium">{file.base}</span>
      {file.schema && SCHEMA_LABELS[file.schema] ? <span className="rounded border px-2 text-[11px] text-muted-foreground" title={file.schema}>{SCHEMA_LABELS[file.schema]}</span> : null}
      <FileTypeBadge kind={file.kind} />
      <span className="text-xs tabular-nums text-muted-foreground">{formatBytes(file.bytes)}</span>
      <PathLink path={file.hostPath} kind="file" label={t('open path')} />
    </div>
    {open ? <div id={id} className="mt-2 min-w-0"><EvidenceSchemaView file={file} authorOp={authorOp} /></div> : null}
  </li>;
}

/** Recorded commit content and submitted evidence, with the commit's authority explicit. */
export function ProductsCard({ project, attempt }: { project: string; attempt: AttemptDetailV3 }) {
  const { products, loading, fallback, error, url, read } = useProducts(project, attempt);
  const key = keyFiles(attempt);
  const files = products?.files ?? [];
  const other = products?.otherChanged ?? [];
  const commit = products?.head ? <span className="text-xs text-muted-foreground">commit <code className="font-mono text-foreground" title={products.head}>{short(products.head)}</code>{products.parent ? <>{t(' · parent')} <code className="font-mono" title={products.parent}>{short(products.parent)}</code></> : null}</span> : null;
  return <Card id="attempt-products" concept="C8" title={t('Products (real output)')} hint={t('Files at the recorded commit and submitted evidence')}>
    <div className="grid min-w-0 gap-6">
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="m-0 text-sm font-medium">{t('Files at the recorded commit')}</h3>
          {files.length ? <span className="text-xs text-muted-foreground">{t('{n} files · click to view content', { n: files.length })}</span> : null}
        </div>
        <ReadWarning read={read} url={url} retained={Boolean(products)} />
        {fallback && error ? <FeedbackState error onRetry={() => refreshQuery(url)}>{error}</FeedbackState> : null}
        {products?.error ? <FeedbackState error onRetry={() => refreshQuery(url)}>{t('Product source unavailable: {error}', { error: products.error })}</FeedbackState> : null}
        {products?.headSource ? <p className="mb-3 mt-0 text-xs text-muted-foreground">{products.headSource === 'runtime-checkpoint' ? t('Content source: recorded runtime checkpoint') : t('Content source: commit tested by the Op; authored output is unproven')}{products.headAt != null ? ` · ${formatAbsolute(products.headAt)}` : ''}</p> : null}
        {loading ? <p className="m-0 text-sm text-muted-foreground">{t('Reading the op files…')}</p>
            : files.length ? <>
              {fallback ? <p className="mb-3 mt-0 rounded-lg border p-2 text-xs text-muted-foreground" data-tone="warning">{t('The server has no products API yet: only the report file list and the patch.diff diff are shown, no content.')}</p> : null}
              <ul className="m-0 flex list-none flex-col divide-y p-0">{files.map(file => <ProductRow key={file.path} file={file} />)}</ul>
            </> : products && !products.error ? <Empty>{t('No file paths are listed for the recorded source.')}</Empty> : null}
        {products?.scope?.truncated ? <p className="mt-2 text-xs text-muted-foreground">{t('Showing {returned} of {listed} recorded file paths; the view is capped.', { returned: products.scope.returned, listed: products.scope.listed })}</p> : null}
        {other.length ? <details className="mt-3 rounded-lg border p-3 text-sm"><summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t('This commit also changed {n} other files', { n: other.length })}</summary>
          <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-xs">{other.map(f => <li key={f.path} className="break-all"><span className="mr-2 text-muted-foreground">{f.status}</span><code className="font-mono">{f.path}</code></li>)}</ul></details> : null}
      </section>

      <Advanced summary={[commit ? `commit ${short(products?.head ?? null)}` : null, t('{n} key evidence files', { n: key.length })].filter(Boolean).join(' · ')}>
        <div className="grid min-w-0 gap-4">
          {commit}
          {products?.reportHead ? <p className="m-0 break-all text-xs text-muted-foreground">{t('Op report-tested head')}: <code>{products.reportHead}</code></p> : null}
          <section className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-x-3"><h3 className="m-0 text-sm font-medium">{t('Key evidence')}</h3>{key.length ? <span className="text-xs text-muted-foreground">{t('{n} files', { n: key.length })}</span> : null}</div>
            {key.length ? <ul className="m-0 flex list-none flex-col divide-y p-0">{key.map((file, i) => <KeyEvidence key={file.artifactId} file={file} authorOp={attempt.op} defaultOpen={i === 0 || file.kind === 'markdown'} />)}</ul>
              : <Empty>{files.length ? t('This op wrote no dedicated evidence files; its products are the repo files above.') : t('This op has no product files or key evidence to show.')}</Empty>}
          </section>
        </div>
      </Advanced>
    </div>
  </Card>;
}
