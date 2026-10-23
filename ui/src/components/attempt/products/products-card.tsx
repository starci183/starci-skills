import type { AttemptDetailV3, AttemptProducts, EvidenceFileV3, EvidenceKind, ProductFile } from '../../../contract';
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
import { ReadWarning, type ReadState } from '../frame/read-warning';
import { JsonView } from '../../evidence/renderers';
import { reportTestedHead } from '../checkpoint';
import { Badge } from '../../ui/badge';

export const concept: Concept = 'C8';

const short = (sha: string | null) => (sha ? sha.slice(0, 9) : '—');
const TEXTY = new Set<EvidenceKind>(['json', 'yaml', 'markdown', 'text']);

/** The report's explicit file declaration; absent data does not become an empty list. */
function declaredFiles(attempt: AttemptDetailV3): string[] | null {
  const report = attempt.report?.json;
  if (!report || typeof report !== 'object' || Array.isArray(report) || !('files' in report) || !Array.isArray(report.files)) return null;
  return report.files.every((path): path is string => typeof path === 'string') ? report.files : null;
}

/** Files the server marks `key`, without the manifest (shown as the checklist above) and without duplicates or empties. */
function keyFiles(attempt: AttemptDetailV3): EvidenceFileV3[] {
  const seen = new Set<string>();
  const out: EvidenceFileV3[] = [];
  for (const file of attempt.files) {
    if (!file.key || isManifestFile(file) || file.empty || file.bytes === 0 || !TEXTY.has(file.kind) || seen.has(file.sha)) continue;
    seen.add(file.sha); out.push(file);
  }
  return out;
}

function KeyEvidence({ file, authorOp, defaultOpen }: Readonly<{ file: EvidenceFileV3; authorOp: string; defaultOpen: boolean }>) {
  return <li className="min-w-0 py-2 first:pt-0 last:pb-0">
    <Advanced defaultOpen={defaultOpen} title={<span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <span className="min-w-0 flex-1 break-all text-sm font-medium">{file.base}</span>
      {file.schema && SCHEMA_LABELS[file.schema] ? <Badge variant="outline" title={file.schema}>{SCHEMA_LABELS[file.schema]}</Badge> : null}
      <FileTypeBadge kind={file.kind} />
      <span className="text-xs font-normal tabular-nums text-muted-foreground">{formatBytes(file.bytes)}</span>
    </span>}>
      <div className="grid min-w-0 gap-4"><PathLink path={file.hostPath} kind="file" label={t('open path')} /><EvidenceSchemaView file={file} authorOp={authorOp} /></div>
    </Advanced>
  </li>;
}

type Products = AttemptProducts | null;

function sourceReadLabel(state: Readonly<{ loading: boolean; fallback: boolean; products: Products; read: ReadState; unavailableFiles: number }>): string {
  const { loading, fallback, products, read, unavailableFiles } = state;
  if (loading) return t('Reading the op files…');
  if (fallback) return t('Declared paths and recorded diff only');
  if (products?.error || (!products && read.error)) return t('Product source unavailable');
  if (read.error) return t('Last successful source response retained');
  if (read.meta?.stale?.length) return t('Some sources unavailable');
  if (unavailableFiles) return t('{n} file reads unavailable', { n: unavailableFiles });
  return products ? t('Recorded commit read available') : t('No product response recorded');
}

function contentSourceLabel(products: Products): string {
  if (products?.headSource === 'runtime-checkpoint') return t('Content source: recorded runtime checkpoint');
  if (products?.headSource === 'report-tested') return t('Content source: commit tested by the Op; authored output is unproven');
  return products ? t('Content source not recorded') : t('Product read source not confirmed');
}

function CommitRef({ head, parent }: Readonly<{ head: string; parent: string | null }>) {
  return <span className="text-xs text-muted-foreground">commit <code className="font-mono text-foreground" title={head}>{short(head)}</code>{parent ? <>{t(' · parent')} <code className="font-mono" title={parent}>{short(parent)}</code></> : null}</span>;
}

function TestedHead({ tested, inCommit }: Readonly<{ tested: string | null; inCommit: boolean }>) {
  if (!tested) return <>{t('Not recorded')}</>;
  return inCommit ? <span className="font-mono" title={tested}>{short(tested)}</span> : <code className="font-mono" title={tested}>{short(tested)}</code>;
}

function SourceNotices({ products, read, url, fallback, error }: Readonly<{ products: Products; read: ReadState; url: string; fallback: boolean; error: string | null }>) {
  return <>
    {products?.scope && !products.error ? <p className="mb-3 mt-0 text-xs text-muted-foreground">{t('Read scope: {returned}/{listed} recorded file paths', { returned: products.scope.returned, listed: products.scope.listed })}</p> : null}
    <ReadWarning read={read} url={url} retained={Boolean(products)} />
    {fallback && error ? <FeedbackState error onRetry={() => refreshQuery(url)}>{error}</FeedbackState> : null}
    {products?.error ? <FeedbackState error onRetry={() => refreshQuery(url)}>{t('Product source unavailable: {error}', { error: products.error })}</FeedbackState> : null}
    {read.error || products?.error || fallback ? <p className="mb-3 mt-2 text-xs text-muted-foreground">{t('Source availability is separate from the Op outcome, verdict and checkpoint receipt.')}</p> : null}
    {fallback ? <p className="mb-3 mt-0 text-xs text-muted-foreground">{t('The server has no products API yet: only the report file list and the patch.diff diff are shown, no content.')}</p> : null}
  </>;
}

function FilesList({ loading, files, products }: Readonly<{ loading: boolean; files: ProductFile[]; products: Products }>) {
  if (loading) return <p className="m-0 text-sm text-muted-foreground">{t('Reading the op files…')}</p>;
  if (files.length) return <ul className="m-0 flex list-none flex-col divide-y p-0">{files.map(file => <ProductRow key={file.path} file={file} />)}</ul>;
  return products && !products.error ? <Empty>{t('No file paths are listed for the recorded source.')}</Empty> : null;
}

function DeclaredPaths({ declared }: Readonly<{ declared: string[] | null }>) {
  if (declared == null) return <>{t('Not recorded')}</>;
  if (!declared.length) return <>{t('Recorded empty list')}</>;
  return <ul className="m-0 list-none p-0">{declared.map((path, index) => <li key={`${index}:${path}`} className="break-all font-mono">{path}</li>)}</ul>;
}

function FilesSection(props: Readonly<{ attempt: AttemptDetailV3; state: ReturnType<typeof useProducts>; declared: string[] | null }>) {
  const { attempt, state, declared } = props;
  const { products, loading, fallback, error, url, read } = state;
  const tested = products?.reportHead ?? reportTestedHead(attempt);
  const testedInCommit = Boolean(tested && [products?.head, products?.parent].some(sha => sha?.toLowerCase() === tested.toLowerCase()));
  const files = products?.files ?? [];
  const other = products?.otherChanged ?? [];
  const unavailableFiles = files.filter(file => file.error != null).length;
  return <section className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h3 className="m-0 text-sm font-medium">{t('Files at the recorded commit')}</h3>
      {files.length ? <span className="text-xs text-muted-foreground">{t('{n} files · click to view content', { n: files.length })}</span> : null}
    </div>
    <div className="mb-4 grid min-w-0 gap-3 text-xs sm:grid-cols-2">
      <div className="min-w-0">
        <p className="m-0 text-muted-foreground">{contentSourceLabel(products)}</p>
        <p className="m-0 mt-1 break-all">{products?.head ? <CommitRef head={products.head} parent={products.parent} /> : t('Not recorded')}{products?.headAt != null ? <span className="text-muted-foreground"> · {formatAbsolute(products.headAt)}</span> : null}</p>
      </div>
      <div className="min-w-0"><p className="m-0 text-muted-foreground">{t('Op report-tested head')}</p><p className="m-0 mt-1"><TestedHead tested={tested} inCommit={testedInCommit} /></p></div>
      <div className="min-w-0"><p className="m-0 text-muted-foreground">{t('Op-declared file paths')}</p><p className="m-0 mt-1">{declared == null ? t('Not recorded') : t('{n} files', { n: declared.length })}</p></div>
      <div className="min-w-0"><p className="m-0 text-muted-foreground">{t('Source read')}</p><p className="m-0 mt-1">{sourceReadLabel({ loading, fallback, products, read, unavailableFiles })}</p></div>
    </div>
    <SourceNotices products={products} read={read} url={url} fallback={fallback} error={error} />
    <FilesList loading={loading} files={files} products={products} />
    {products?.scope?.truncated ? <p className="mt-2 text-xs text-muted-foreground">{t('Showing {returned} of {listed} recorded file paths; the view is capped.', { returned: products.scope.returned, listed: products.scope.listed })}</p> : null}
    {other.length ? <Advanced className="mt-4" title={t('This commit also changed {n} other files', { n: other.length })} keepMounted>
      <ul className="m-0 grid list-none gap-2 p-0 text-xs">{other.map(f => <li key={f.path} className="break-all"><span className="mr-2 text-muted-foreground">{f.status}</span><code className="font-mono">{f.path}</code></li>)}</ul></Advanced> : null}
  </section>;
}

function KeyEvidenceSection({ keyFiles: key, op }: Readonly<{ keyFiles: EvidenceFileV3[]; op: string }>) {
  return <section className="min-w-0">
    <div className="mb-2 flex flex-wrap items-center gap-x-3"><h3 className="m-0 text-sm font-medium">{t('Key evidence')}</h3>{key.length ? <span className="text-xs text-muted-foreground">{t('{n} files', { n: key.length })}</span> : null}</div>
    {key.length ? <ul className="m-0 flex list-none flex-col divide-y p-0">{key.map((file, i) => <KeyEvidence key={file.artifactId} file={file} authorOp={op} defaultOpen={i === 0 || file.kind === 'markdown'} />)}</ul>
      : <Empty>{t('No key evidence files are listed for this Attempt.')}</Empty>}
  </section>;
}

function ProvenanceBody(props: Readonly<{ attempt: AttemptDetailV3; state: ReturnType<typeof useProducts>; declared: string[] | null; keyFiles: EvidenceFileV3[] }>) {
  const { attempt, state, declared, keyFiles: key } = props;
  const { products, read } = state;
  const repo = products?.repo ?? attempt.where.repo;
  return <div className="grid min-w-0 gap-4">
    <dl className="m-0 grid min-w-0 gap-3 text-xs sm:grid-cols-2">
      <div className="min-w-0"><dt className="text-muted-foreground">{t('Repository')}</dt><dd className="m-0 mt-1 break-all">{repo ? <PathLink path={repo} kind="dir" label={repo} /> : t('Not recorded')}</dd></div>
      <div className="min-w-0"><dt className="text-muted-foreground">{t('Last successful API read')}</dt><dd className="m-0 mt-1">{read.observedAt == null ? t('Not recorded') : formatAbsolute(read.observedAt)}</dd></div>
      <div className="min-w-0"><dt className="text-muted-foreground">{t('Op-declared file paths')}</dt><dd className="m-0 mt-1"><DeclaredPaths declared={declared} /></dd></div>
      {products?.errorCode ? <div className="min-w-0"><dt className="text-muted-foreground">{t('Source read code')}</dt><dd className="m-0 mt-1 break-all font-mono">{products.errorCode}</dd></div> : null}
    </dl>
    {read.meta ? <section className="min-w-0"><h3 className="m-0 mb-2 text-sm font-medium">{t('Products API metadata')}</h3><JsonView text={JSON.stringify(read.meta, null, 2)} /></section> : null}
    {products?.claims.length ? <section className="min-w-0"><h3 className="m-0 mb-2 text-sm font-medium">{t('Op-declared product claims')}</h3><JsonView text={JSON.stringify(products.claims, null, 2)} /></section> : null}
    <KeyEvidenceSection keyFiles={key} op={attempt.op} />
  </div>;
}

/** Recorded commit content and submitted evidence, with the commit's authority explicit. */
export function ProductsCard({ project, attempt }: Readonly<{ project: string; attempt: AttemptDetailV3 }>) {
  const state = useProducts(project, attempt);
  const key = keyFiles(attempt);
  const declared = declaredFiles(attempt);
  const head = state.products?.head ?? null;
  return <Card id="attempt-products" concept="C8" title={t('Products')} hint={t('Recorded source files and submitted evidence')}>
    <div className="grid min-w-0 gap-6">
      <FilesSection attempt={attempt} state={state} declared={declared} />

      <Advanced summary={[head ? `commit ${short(head)}` : null, t('{n} key evidence files', { n: key.length })].filter(Boolean).join(' · ')}>
        <ProvenanceBody attempt={attempt} state={state} declared={declared} keyFiles={key} />
      </Advanced>
    </div>
  </Card>;
}
