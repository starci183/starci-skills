import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { AttemptDetailV3, EvidenceFileV3, EvidenceKind } from '../../../contract';
import type { Concept } from '../../concept';
import { EvidenceSchemaView, SCHEMA_LABELS } from '../../evidence/schema/evidence-schema-view';
import { PathLink } from '../../path-link';
import { FileTypeBadge } from '../../status-chip';
import { Card, Empty } from '../frame/card';
import { formatBytes } from '../frame/util';
import { isManifestFile } from '../result/manifest';
import { ProductRow } from './product-row';
import { useProducts } from './use-products';

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
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" title={open ? 'Thu gọn' : 'Mở'}>
        <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
      </button>
      <span className="min-w-0 flex-1 break-all text-sm font-medium">{file.base}</span>
      {file.schema && SCHEMA_LABELS[file.schema] ? <span className="rounded border px-1.5 text-[11px] text-muted-foreground" title={file.schema}>{SCHEMA_LABELS[file.schema]}</span> : null}
      <FileTypeBadge kind={file.kind} />
      <span className="text-xs tabular-nums text-muted-foreground">{formatBytes(file.bytes)}</span>
      <PathLink path={file.hostPath} kind="file" label="mở" />
    </div>
    {open ? <div id={id} className="mt-2 min-w-0"><EvidenceSchemaView file={file} authorOp={authorOp} /></div> : null}
  </li>;
}

/** Block 5 "Sản phẩm (đầu ra thật)": the repo files the op wrote (content + diff) and its key evidence. */
export function ProductsCard({ project, attempt }: { project: string; attempt: AttemptDetailV3 }) {
  const { products, loading, fallback } = useProducts(project, attempt);
  const key = keyFiles(attempt);
  const files = products?.files ?? [];
  const other = products?.otherChanged ?? [];
  return <Card id="attempt-products" concept="C8" title="Sản phẩm (đầu ra thật)" hint="Tệp op đã ghi vào repo và bằng chứng chính">
    <div className="grid min-w-0 gap-6">
      <section className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-sm font-medium">Tệp op đã ghi vào repo</h3>
          {files.length ? <span className="text-xs text-muted-foreground">{files.length} tệp</span> : null}
          {products?.head ? <span className="ml-auto text-xs text-muted-foreground">commit <code className="font-mono text-foreground" title={products.head}>{short(products.head)}</code>{products.parent ? <> · cha <code className="font-mono" title={products.parent}>{short(products.parent)}</code></> : null}</span> : null}
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Đang đọc tệp của op…</p>
          : products?.error ? <Empty>Không đọc được commit của op: {products.error}</Empty>
            : files.length ? <>
              {fallback ? <p className="mb-2 rounded-lg border border-dashed p-2 text-xs text-muted-foreground" data-tone="warning">Máy chủ chưa có API sản phẩm: chỉ hiện danh sách tệp trong báo cáo và diff từ patch.diff, chưa có nội dung.</p> : null}
              <ul className="divide-y">{files.map((file, i) => <ProductRow key={file.path} file={file} defaultOpen={i === 0} />)}</ul>
            </> : <Empty>Op không ghi tệp nào vào repo (báo cáo không liệt kê tệp).</Empty>}
        {other.length ? <details className="mt-3 rounded-lg border px-3 py-2 text-sm"><summary className="cursor-pointer text-muted-foreground hover:text-foreground">Commit này còn đổi {other.length} tệp khác</summary>
          <ul className="mt-2 grid gap-1 text-xs">{other.map(f => <li key={f.path} className="break-all"><span className="mr-2 text-muted-foreground">{f.status}</span><code className="font-mono">{f.path}</code></li>)}</ul></details> : null}
      </section>

      <section className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3"><h3 className="text-sm font-medium">Bằng chứng chính</h3>{key.length ? <span className="text-xs text-muted-foreground">{key.length} tệp</span> : null}</div>
        {key.length ? <ul className="divide-y">{key.map((file, i) => <KeyEvidence key={file.artifactId} file={file} authorOp={attempt.op} defaultOpen={i === 0 || file.kind === 'markdown'} />)}</ul>
          : <Empty>{files.length ? 'Op này không ghi tệp bằng chứng riêng; sản phẩm của nó là các tệp repo ở trên.' : 'Op này không có tệp sản phẩm lẫn bằng chứng chính nào để hiển thị.'}</Empty>}
      </section>
    </div>
  </Card>;
}
