# Size growth

Law module: `size-growth.mjs`. Catalogue: R20 HFS_SIZE_GROWTH.

A source file has a line budget, `ruleParams.fe.fileLines` of `knowledge/hfs/slots.yaml`, read through `lib/params.mjs` (the package ships its own copy of the manifest in `runtime/`). A file over the budget may not be new and may not be longer than it was at the parent commit; a file within the budget is never a finding. The rule takes no option, there is no baseline file and no allowlist: the record is the repository's own history. `*.d.ts` declaration files are not governed.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/file-size-growth`

A source file over the budget is neither new nor longer than its recorded size.

**Invalid** (`src/components/Card/index.tsx`)

```ts
// a new file with more lines than the budget, or an existing file over the budget that gained a line
```

**Valid** (`src/components/Card/index.tsx`)

```ts
// a file within the budget, or an oversized file that stayed the same size or shrank
```

**Finding code:** `HFS_SIZE_GROWTH`

**Vì sao (why):** `<file>` vượt ngân sách dòng: file mới đã dài quá mức, hoặc file cũ dài hơn bản ở commit cha. Mỗi file phải nhỏ để một người đọc hết và một bài test phủ hết.

**Cách sửa:** Tách phần mới sang file riêng theo trách nhiệm; một file đã vượt ngân sách chỉ được giữ nguyên hoặc ngắn lại.
