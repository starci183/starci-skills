# A3 chạy khô 1 — `fe.presentation.resolve` trên `dashboard/ContinueLearning`

Ngày 2026-09-02. Fixture là `starci-academy-fe/src/components/blocks/dashboard/ContinueLearning/component.tsx`
ở head `6f764b1a`, Grammar `@starci/grammar@0.4.0`, topic `gap` ở fingerprint hiện tại. Chỉ bind topic
`gap`, vì block này không mang thuộc tính presentation nào khác.

Cả hai artifact qua validator của chính operator; một bản cố tình sai bị chặn với thông điệp
`$.operatorId: expected "fe.presentation.resolve"`, nên màu xanh này là đo được chứ không phải giả
định: [input.json](input.json), [output.json](output.json).

## Đi từng node

| Node | Quan sát | Case khớp | Owner | Kết quả |
| --- | --- | --- | --- | --- |
| `SurfaceCard composition="joined"` ngoài cùng | các mặt nối liền | GAP-0 Case 3 | `SurfaceCard` | `GRAMMAR_OWNED`, không class |
| `div.grid gap-2 md:grid-cols-2 xl:grid-cols-3` chứa các `SurfaceCard` | thẻ của một bộ sưu tập xếp lưới | GAP-4 Case 2, đúng một | `App` | resolve thành `gap-4`; `gap-2` trong source là lệch giá trị mà resolver sẽ viết lại |
| `div.grid grid-cols-[auto_1fr] gap-3` nổi bật (`IconTile` cạnh khối chữ) | dấu dẫn đầu cạnh khối nội dung trong một thẻ | không có | — | `RULE_MISSING` |
| `div.grid grid-cols-[auto_1fr] gap-2` gọn | cùng quan hệ, mục phụ | không có | — | `RULE_MISSING` |
| `div.flex flex-col gap-3` (cặp danh tính rồi `TextAction`) | cột chữ mà con cuối là hành động gắn với nó | không có (GAP-3 Case 1 là field và action nằm ngang) | — | `RULE_MISSING` |
| `div.flex flex-col gap-1` (nhãn loại dưới tiêu đề) | tiêu đề và định ngữ ngắn của nó | GAP-1 Case 1, đúng một | `—` | `gap-1`, `COMMON_CAPABILITY_MISSING` |
| `Text`, `IconTile`, `TextAction`, `Icon` | lá Grammar | — | Grammar | không thuộc app |

## Kết quả

`blocked` · `RULE_MISSING` · owning domain `knowledge`. Theo `execute.md`, operator không làm tròn về
case gần nhất và không chép node bên cạnh, nên các quan hệ không khớp làm invocation dừng trước khi
ghi bất kỳ cây resolved nào. Vòng lặp không thể sang `fe.source.apply` trên block này cho tới khi chủ
knowledge publish các case còn thiếu và fingerprint của topic `gap` được bind lại.

## Trả về cho chủ knowledge

1. `gap.md` cần một case cho dấu dẫn đầu (`IconTile`) cạnh khối nội dung trong một thẻ, nói rõ owner:
   `App` ở một bậc, hay một component Common nếu nó đã sở hữu quan hệ đó. Source đang dùng hai bậc khác
   nhau (`gap-3` nổi bật, `gap-2` gọn) cho cùng một quan hệ, nên case cũng phải nói nhấn mạnh có đổi
   bậc hay không.
2. `gap.md` cần một case cho cột chữ xếp dọc mà con cuối là hành động gắn với phần chữ đó. Hôm nay chỉ
   có cặp field và action nằm ngang được publish.

### Vì sao phiên này không publish hai case đó

Đếm trên bằng chứng được phép (`blocks/dashboard/*`, `blocks/commerce/ProSubscriptionBlock`): quan hệ
dấu dẫn đầu cạnh khối chữ chỉ xuất hiện ở một block, với hai bậc khác nhau; quan hệ cột chữ kết thúc
bằng hành động cũng chỉ ở một block. Common chỉ ghép `IconTile` bên trong `EmptyNotice` (xếp dọc, căn
giữa, `gap-3 p-4`), nên không component nào sở hữu hai quan hệ này. Viết case từ một trường hợp duy
nhất với hai bậc là bịa luật; khoảng trống giữ nguyên cho tới khi có block được phép thứ hai hoặc một
capability Common quyết định nó.

## Ghi nhận cho chủ source (không phải việc của resolver)

Lưới bộ sưu tập đang render `gap-2` trong khi case duy nhất khớp là `gap-4`. Khi hai case ở trên có
mặt và block resolve được, `fe.source.apply` sẽ viết lại class đó; lần chạy khô này không đổi gì.

## Lần chạy khô này chứng minh gì về cây

- Hợp đồng input điền được từ fingerprint thật mà không phải bịa trường nào.
- Kho rule trong input khớp từng heading trong `gap.md` đã publish.
- Receipt blocked mang đủ để resume: đường dẫn node, ref còn thiếu, delta cần có.
- `RULE_MISSING` chạm được ngay ở block thật đầu tiên: operator đang hành xử đúng thiết kế, và đây là
  bằng chứng đầu tiên rằng `presentation/gap.md` được viết từ quá ít block.
