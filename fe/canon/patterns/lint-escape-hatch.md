# lối thoát của lint

## Định nghĩa

Lối thoát của lint là đoạn source làm thay đổi những luật áp dụng cho file chứa nó:
`eslint-disable`, các biến thể theo dòng của nó hoặc `eslint-enable`. Nó biến luật của repository
thành lựa chọn cục bộ, để chính tác giả của vi phạm cũng quyết định việc đó có bị xem là vi phạm hay
không.

Luật này được bảo đảm bởi
[`sources/fe/lint-escape-hatch.mjs`](../../../sources/fe/lint-escape-hatch.mjs). Flat config của
project sử dụng cũng áp dụng `linterOptions.noInlineConfig` đã export, vì một rule có thể bị vô hiệu
hóa bởi chính comment mà nó báo cáo thì không thể là hàng rào bảo vệ.

Implementation anchors in `starci-academy-fe`: `eslint.config.mjs` and
`plugins/eslint/index.mjs`.

## Luật

**LINT-ESCAPE-1 · Product source không được chứa chỉ thị ESLint inline.**

Mọi rule đều là policy của repository ở mức `error`. Một file không thể tự hạ mức, tạm dừng hay
khôi phục policy đó; nếu rule sai, matcher của rule hoặc kiến trúc phải được sửa cho tất cả mọi
người.

**LINT-ESCAPE-2 · Flat config vô hiệu hóa inline configuration.**

Rule báo cáo nỗ lực bypass, còn `noInlineConfig` khiến nỗ lực đó không có hiệu lực. Cả hai đều cần
thiết: một thứ giải thích lỗi, thứ kia bảo đảm chỉ thị không thể tự làm im lặng hàng rào của mình.

**LINT-ESCAPE-3 · Không có allowlist.**

Component mỏng, ranh giới vendor, declaration, file trông như được sinh tự động và công việc
migration tạm thời đều không được hưởng miễn trừ cục bộ. Cú pháp hợp lệ phải được biểu diễn trong
shared configuration hoặc closed type; debt phải được sửa trước khi merge thay vì che giấu bên cạnh
nó.

## Forbidden

| Không bao giờ | Vì sao bị từ chối | Thay vào đó |
|---|---|---|
| `eslint-disable` trong product source | Chính file vi phạm quyết định luật của repository có áp dụng hay không | Sửa code hoặc shared rule |
| `eslint-disable-next-line` kèm lý do | Lý do chỉ ghi lại bypass, không ngăn bypass | Mã hóa trường hợp hợp lệ trong rule hoặc type |
| Path allowlist cho một component | Ngoại lệ trở thành vĩnh viễn và vô hình tại call site | Nêu trường hợp ngữ nghĩa trong shared matcher |
| Rule kiến trúc ở mức warning | Vi phạm mới vẫn được merge dù trông như đang được kiểm soát | Dùng mức Error, kèm twin test |

## Ví dụ

### Bypass cục bộ

```ts
declare module "vendor" {
    namespace VendorTypes {}
}
```

```ts
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace VendorTypes {}
```

Chúng chỉ khác nhau ở một điểm: cú pháp declaration hợp lệ do cấu hình repository làm chủ, hay một
file tự đình chỉ luật cho chính nó.

### Phát hiện kiến trúc

```tsx
return <_CreditStatRow state="pending" props={{ label }} />
```

```tsx
/* eslint-disable starci-fe/connected-block-has-presentational-twin */
return <StatRow props={{ label }} isLoading />
```

Chúng chỉ khác nhau ở một điểm: ranh giới connected/presentational còn tồn tại hay không.
