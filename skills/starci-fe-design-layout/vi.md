---
title: Frontend design layout · Vietnamese
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@contract-search` | `scripts/contract-search.mjs` | script | tìm contract entry theo nhu cầu đã phát biểu |
| `@layout-schema` | `brainstorms/layouts/schema.json` | file | kiểm tra JSON layout candidate |
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate và hash candidate artifact |

## HANDS OFF TO — named, never loaded

`starci-init`

## Cách chạy

Đọc `@skill-shape` trước. Không có orchestrator, nên skill này tự mở hoặc resume session.

**JSON mới là artifact; HTML chỉ là cách quan sát.** Approval bind vào hash của canonical JSON, không bind
vào trang render.

## QUY TRÌNH

### 1 — In CONTEXT

In `### CONTEXT` trước khi chạm bất cứ thứ gì. `Phase` là `layout`. `Touching` chỉ gồm project registry và
session, không gồm file nào trong frontend repository.

### 2 — Resolve và kiểm tra workspace route

Đọc `.workspace/<project>/<role>/config.json` của role `fe`. Trước khi đọc source, kiểm tra checkout tồn
tại và `context.contract` vẫn là file thật. Route stale phải **dừng lượt chạy** (`WORKSPACE-5`); không chọn
checkout gần nhất rồi tiếp tục với contract của sản phẩm khác.

### 3 — Resolve worktree roots

Registry ở `<Source>/.worktrees/<project>/registries` phải lock, sạch, đúng project branch và thuộc Git
của Source này (`WORKTREE-1`, `WORKTREE-4`). Preview nằm tại
`<Source>/.worktrees/<project>/cache/preview` (`WORKTREE-2`), không bao giờ dưới `.claude`
(`WORKTREE-3`).

### 4 — Resume hoặc mở session

**Surface quyết định identity của session**, không phải cách viết prompt. Hai request khác lời cho cùng
page vẫn là một session; prompt viết lại chỉ mở round mới. In `resumed <id>` hoặc `opened <id>` và giữ mọi
accepted hash khi resume.

### 5 — Đọc sáu input đúng mức reduction đã khai

| Input | Nội dung đọc |
|---|---|
| request | nguyên văn |
| contract | **query, không đọc cả file** — mỗi region một need qua `@contract-search`; chỉ nhận `key`, `why`, `host`, không nhận class array |
| branches | mọi branch và nội dung mỗi branch được phép chứa |
| routes | mọi route page và persistent layout |
| axes | closed diversity set |
| precedents | candidate accepted của project cùng các lần bị bác |

Đọc class array là defect, không phải tối ưu. Stage không nhìn thấy class thì không thể chép class vào
candidate; script giữ trần này bằng cách không trả class về.

### 6 — Resolve từng region theo contract, mỗi region một query

```bash
node @contract-search <project> <role> --need "<the region stated as a need>"
```

Hỏi bằng **lý do**, không hỏi bằng shape. Kết quả có dấu `~` chỉ khớp từ ngẫu nhiên, không phải câu trả
lời. Mỗi region nhận đúng một verdict:

- `reuse <key>` — `why` hiện có đã trả lời region;
- `generalize <key> -> <key>` — entry đúng nghĩa nhưng mang tên feature; phải đo call-site count trước;
- `new <key>` — không entry nào trả lời reason; ghi `why` entry mới sẽ mang.

Không có call-site count thì từ chối `generalize`, không đoán.

Query không có kết quả exit 1 và cho hai dữ kiện: với lượt này là verdict `new`; với tree là finding rằng
một surface thật không tìm được entry theo need. Đưa nguyên need vào `WARNINGS` để chỉ đúng reason đã fail.

### 7 — Sinh 3–4 candidate

Mỗi candidate khai axis values. Trùng toàn bộ axis set nghĩa là cùng một candidate. Ít nhất một candidate
phải khác nearest precedent. Nếu request thật sự chỉ cho phép một cấu trúc, trả một và nói lý do; không
độn batch cho đủ ba.

### 8 — Từ chối quyết định chỉ owner mới được đưa ra

Product decision mà request không nói và luật không suy ra được phải tạo refusal block. Refusal đi cùng
candidates để phần còn lại của batch vẫn đọc được.

### 9 — Validate, hash, ghi JSON, rồi render preview

```bash
node @validate-artifact \
  --schema @layout-schema \
  --data <batch.json> --hash
```

Schema dùng `additionalProperties: false` để class trở thành unrepresentable. Validator còn từ chối class
token, candidate trùng axis set và batch không candidate nào viện dẫn `none`. Hash chỉ phủ candidate,
không phủ envelope; cùng quyết định phải sinh cùng hash ở round sau.

Render mỗi candidate thành một trang HTML trong `cache/preview`, rồi serve:

```bash
npx -y http-server .worktrees/<project>/cache/preview -p 8080 -c-1 --silent
```

CSS preview chỉ là documentation chrome: vẽ region, tên, axis, entry và branch. Nó không mang product
class và không được trở thành nguồn class cho phase sau.

### 10 — Đưa vào hàng phê duyệt và ghi verdict

Queue nằm trong `registries` vì pending decision phải bền; `sessions` có thể bỏ. Accepted thì bind hash.
Feedback thì mở **round mới**, không sửa round accepted; append và ghi `REJECTED` với candidate thật,
phương án thay và lời owner.

### 11 — Đóng phase

In sáu bảng. `OWED` gọi tên block round chưa diễn ra.

## Điểm dừng

- Route không có hoặc stale → trả về `starci-init`.
- Registry không lock, dirty hoặc thuộc Git khác → dừng, không ghi.
- Class cần dùng không nằm trong closed set của contract → đây là **contract change**, trả owner.
- Hai candidate còn trùng axis set → chúng là một; sinh lại thay vì đưa ra lựa chọn giả.

## ĐẦU RA

Sáu bảng của skill shape, đúng thứ tự. `OUTPUTS` gọi tên session, candidate và hash; `CHANGES` gọi tên
registry path đã ghi; `NEED APPROVALS` giữ accept/feedback và refusal; `WARNINGS` giữ stale-reference risk;
`REJECTED` giữ lời owner; `OWED` giữ block round.
