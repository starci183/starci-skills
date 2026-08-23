---
title: Source references · Vietnamese
---

# Tham chiếu source

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@catalog` | `compilers/patterns/source-references/references.json` | file | gắn precedent FE và BE vào repository, commit và source root bất biến |
| `@resolve` | `compilers/patterns/source-references/resolve.mjs` | script | kiểm tra checkout cục bộ đã khai báo hoặc materialize đúng commit vào workspace cache |

## Bản ghi

Module này cung cấp implementation precedent dùng chung cho cả frontend và backend pattern compiler.
Nó rộng hơn Apollo, GraphQL hay bất kỳ capability riêng nào: compiler chỉ đọc lát nhỏ nhất liên quan
đến module layout, client construction, transport, authentication, storage, CQRS, testing hoặc source
concern đã chốt khác. Reference là bằng chứng cho shape, không phải product truth hay source để chép.

## Mã tình huống

| Mã | Tình huống | Kết quả bắt buộc |
|---|---|---|
| `SOURCE-REF-1` | Pattern FE compile một capability hoặc family dùng chung | Resolve reference `fe` đúng commit, chỉ đọc path liên quan và trích dẫn exact reference path cho mọi precedent được nhận |
| `SOURCE-REF-2` | Pattern BE compile một capability hoặc operation family dùng chung | Resolve reference `be` đúng commit, chỉ đọc path liên quan và trích dẫn exact reference path cho mọi precedent được nhận |
| `SOURCE-REF-3` | Không workspace reference đã init nào chứa immutable commit | Dừng trước target-specific pattern reads và route Source qua `starci-init`; initialization sở hữu `.workspace/references/<id>`, pattern compiler không tự clone hoặc fetch |
| `SOURCE-REF-4` | Target repository đã có sibling cùng loại | Target sibling vẫn là chuẩn chính; shared reference chỉ phản biện hoặc bù convention còn thiếu và không được ghi đè ownership đang sống |
| `SOURCE-REF-5` | Hành vi reference xung đột business truth, live schema, grammar hoặc target contract đã route | Authority target thắng; ghi nhận xung đột và không nhập hành vi reference |

## Cách resolve

1. Đọc `@catalog`; chỉ chọn reference khớp role đang compile.
2. Chạy `@resolve --role <role>`. Script validate `.workspace/pattern-references.json`, `workspacePath`
   portable, checkout dưới `.workspace/references/<id>`, remote identity và immutable commit.
3. Kết quả `needs-init` dừng pattern compilation và quay về `starci-init`. Chỉ initialization mới
   được reuse checkout hiện hữu hoặc cài immutable object vào workspace cache của Source.
4. Chỉ đọc source paths nhỏ nhất cần để trả lời pattern situation đã nhận. Không inventory toàn bộ
   reference repository hoặc nhập kiến trúc không liên quan.
5. Đối chiếu target sibling, reference precedent và authority target. Giữ target sibling khi nó đã trả
   lời được situation; nếu chưa thì chỉ mirror family shape có bằng chứng.
6. Xuất exact `git+https://...@<40-char-commit>:<path>` và mọi concrete source path đã dùng.

## Quy tắc

1. Reference là bằng chứng Git bất biến, không phải branch URL mutable hay path máy cục bộ.
2. Module này trung lập công nghệ; không client, framework hay transport nào có registry riêng trùng lặp.
3. Pattern compilation chỉ đọc reference; nó không clone, fetch, pull hoặc viết lại workspace route.
4. Local registry chỉ lưu `workspacePath` tương đối với Source, không lưu absolute disk path; durable authority không phụ thuộc layout máy.
5. Business truth, schema, grammar, contract và same-repository sibling của target có ưu tiên cao hơn precedent.
6. Cấm chép product logic, credential, generated output hoặc feature vocabulary từ reference.
7. Mọi precedent được nhận phải trích reference id, immutable ref và exact source paths đã chứng minh nó.

## Output

```text
role: <fe | be>
reference: <id>
immutableRef: <git+https://...@commit:path>
checkout: <verified machine-local path>
targetSibling: <path | none>
referencePaths: <smallest exact paths inspected>
decision: <target sibling preserved | reference shape mirrored | new family required>
reason: <authority and evidence that decided it>
```
