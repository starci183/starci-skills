---
title: Frontend design block · Vietnamese
---

# starci-fe-design-block

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@block-schema` | `brainstorms/blocks/schema.json` | file | kiểm tra JSON mô tả anatomy của block |
| `@session` | `skills/skill-shape/session.schema.json` | file | hình dạng mà một design session được ghi ra |
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate và hash candidate artifact |

## HANDS OFF TO — named, never loaded

None.

## Cách chạy

Đọc `@skill-shape` trước. Skill này chỉ làm việc trong session đã bind bằng hash; nó không tự mở session.

**JSON mới là artifact; HTML chỉ là cách quan sát.** Approval bind vào hash của canonical JSON, không bind
vào trang render.

## QUY TRÌNH

### 1 — In CONTEXT

`Phase` là `block`. `Touching` chỉ gọi tên project registry.

### 2 — Yêu cầu layout đã accepted

Hash đã chấp nhận đọc từ bản ghi session mà `@session` mô tả; một round block được ghi thêm vào **chính**
session đó, không mở session mới.

Đọc session. Một region chỉ được đi vào block round khi layout candidate chứa nó có hash **accepted**.
Proposed layout không phải điểm bắt đầu vì mọi anatomy dựng trên đó sẽ bị bỏ cùng layout.

Không có layout hash accepted thì dừng và gọi tên hash đang chờ.

### 3 — Kiểm tra route và các root

Kiểm tra route `fe` trước khi đọc (`WORKSPACE-5`), rồi kiểm tra lock, độ sạch và owner của registry
(`WORKTREE-1`, `WORKTREE-4`). Preview phải nằm trong `cache/preview` (`WORKTREE-2`), không bao giờ nằm dưới
`.claude` (`WORKTREE-3`).

### 4 — Đọc bảy input

| Input | Nội dung đọc |
|---|---|
| region | region đã accepted và lý do nghiệp vụ |
| contract | key, `why`, `host`, tên children, `repeats`, `optional` — không đọc class array |
| vocabulary | leaf, composite và block đã tồn tại mà contract viện dẫn |
| axes | tập anatomy đóng: data owner, repetition, weight, composition |
| precedents | anatomy accepted của project cùng các lần bị bác |
| states | dữ liệu của region thực sự lỗi thế nào, đọc từ page và block source |
| laws | các luật block |

`optional` chỉ nói về **sự hiện diện**, không nói vắng mặt theo kiểu nào. Pending, failed và empty cùng đi
qua một `optional`; phải đọc source để phân biệt, không được đoán từ registry.

### 5 — Liệt kê state trước khi thiết kế

Liệt kê mọi trạng thái region có thể vào: populated, empty, pending, failed, partial, forbidden. Anatomy
phải bao phủ cả tập, không chỉ happy path. State reachable mà anatomy không vẽ là defect, không phải việc
để sau.

### 6 — Resolve part theo contract và vocabulary

Tìm bằng `why`. Mỗi part nhận đúng một verdict: `reuse <key>`, `generalize <key> -> <key>` kèm số call site
đã đo, hoặc `new <key>` kèm `why`. Mọi leaf và composite được viện dẫn phải có trong vocabulary; tên không
kiểm tra được là tên tự bịa.

### 7 — Sinh 3–4 anatomy

Mỗi anatomy khai giá trị các axis: ai sở hữu data, có lặp không và resting count, state nào mang block,
cách composition. Trùng toàn bộ axis nghĩa là cùng một anatomy. Ít nhất một phương án phải khác nearest
precedent.

### 8 — Từ chối quyết định chỉ owner mới được đưa ra

Ai sở hữu data, empty region có phải outcome thật không, resting count là bao nhiêu khi request không nói
— đó là product decision. Gửi refusal block cùng candidates, không tự đoán.

### 9 — Validate, hash, ghi JSON, rồi render preview

```bash
node @validate-artifact \
  --schema @block-schema \
  --data <batch.json> --hash
```

Validator từ chối class token, hai anatomy trùng axis set, anatomy `repeats` thiếu `restingCount`, hoặc
batch không có anatomy nào viện dẫn `none`. Hash chỉ phủ anatomy, không phủ envelope.

Render mỗi anatomy thành một trang HTML trong `cache/preview`, gồm **mọi state đã liệt kê**, rồi serve:

```bash
npx -y http-server .worktrees/<project>/cache/preview -p 8080 -c-1 --silent
```

**8080 là chỗ bắt đầu tìm, không phải chỗ dừng.** Thử bind nó; bị chiếm thì thử 8081, 8082, cứ thế cho tới
khi bind được, rồi **in ra URL thật sự đang phục vụ**. Một lượt chạy chết vì dev server của người khác đang
giữ 8080 là chết ở chỗ chẳng ai hỏi tới, còn in ra một URL không ai mở được thì tệ hơn là không in. Chặn số
lần thử lại — hai mươi cổng là máy đang bận, hai trăm là có lỗi — và nếu không cổng nào bind được thì nói
ra, đừng lặng lẽ phục vụ vào hư không.


CSS của preview chỉ là documentation chrome, không phải product class. Preview chỉ có populated state
đang che giấu đúng quyết định mà phase này phải làm lộ ra.

### 10 — Đưa vào hàng phê duyệt và ghi verdict

Queue nằm trong `registries`, không nằm trong `sessions`. Accepted thì bind hash. Có feedback thì mở
**round mới**, append và ghi `REJECTED` với anatomy thật, phương án thay thế và lời owner.

### 11 — Đóng phase

In sáu bảng. `OWED` gọi tên region chưa có anatomy accepted.

## Điểm dừng

- Không có layout hash accepted → dừng và gọi tên hash đang chờ.
- Part viện dẫn leaf/composite không tồn tại → dừng; vocabulary là thẩm quyền.
- Không xác định được state từ source → refusal, không đoán.
- Registry không lock, dirty hoặc thuộc Git khác → dừng, không ghi.

## ĐẦU RA

Sáu bảng của skill shape, đúng thứ tự.
