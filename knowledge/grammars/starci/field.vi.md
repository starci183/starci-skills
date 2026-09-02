# StarCi Core — Field

File này map các luật `FIELD-n` vào family Core đang chạy: nhãn, control, hướng dẫn, kiểm tra, yêu cầu,
giá trị và tính khả dụng của một field như một quan hệ được sở hữu duy nhất. Chữ `gap` ở cột cuối
nghĩa là Common không công bố owner nào cho case đó.

Owner text-field duy nhất là `Input { id, name, label: ReactNode, kind?: "email" | "password" |
"newPassword" | "code" | "text", variant?: "primary" | "secondary", placeholder?, defaultValue?,
value?, hint?, errorMessage?, isError?, isDisabled?, isRequired?, isSkeleton?, revealLabel?,
hideLabel?, revealIcon?, hideIcon?, onValueChange? }`. Nó render HeroUI `TextField` ghép `Label`,
một `Description` tuỳ chọn, `Input` gốc và một `ErrorMessage` tuỳ chọn. Owner mã một lần là
`OtpInput { id, name, defaultValue?, disabled?, invalid?, describedBy?, onChange? }`, sáu slot HeroUI
`InputOTP` bên trong một `HorizontalScrollRegion`.

## FIELD-1 — Một chồng field được sở hữu

Một giá trị sửa được có một danh tính nhìn thấy, một control và một authority giá trị.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Danh tính và control | `Input label` → HeroUI `Label`; `id`, `name` và `kind` → `id`, `name`, `type`, `autoComplete` và `inputMode` của input gốc (`email`, `current-password`, `new-password`, `one-time-code` hoặc `off`) | Token field: `--field-background` → `--starci-core-surface`, `--field-border: transparent`, `--field-foreground` → `--starci-core-foreground`, `--field-placeholder` → `--starci-core-muted`, `--field-radius` → `--starci-core-control-radius` |
| Case 2 | Authority giá trị | `value` có kiểm soát hoặc `defaultValue` không kiểm soát, không bao giờ cả hai; `onValueChange(value)` báo thay đổi gốc | Thừa kế nguyên vẹn |
| Case 3 | Các kind bí mật | `password` và `newPassword` thêm một `button` bật tắt hiện mật khẩu, đặt tên bằng `revealLabel`/`hideLabel`, vẽ bằng `revealIcon`/`hideIcon` hoặc chính chữ nhãn, bị vô hiệu cùng với field | Thừa kế nguyên vẹn |
| Case 4 | Field mã một lần | `gap` — `OtpInput` không công bố slot `label`, `hint` hay `errorMessage`; chỉ `describedBy` nối tới chữ bên ngoài, nên danh tính nhìn thấy của nó không có owner Common | Thừa kế nguyên vẹn |

Source: packages/grammar/src/common/renderers.ts → packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/OtpInput.tsx; packages/grammar/src/core/styles.css

## FIELD-2 — Helper và error có việc khác nhau

Hướng dẫn là hướng tới tương lai; error là lỗi hiện tại và cách sửa nó.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Hướng dẫn | `hint` → HeroUI `Description`, render giữa nhãn và control | Thừa kế nguyên vẹn |
| Case 2 | Lỗi hiện tại | `errorMessage` → HeroUI `ErrorMessage` sau control; field không hợp lệ khi `isError` đúng hoặc có `errorMessage` (`isInvalid={isError \|\| errorMessage != null}`) | Màu không hợp lệ phân giải qua `--danger` → `--starci-core-danger` |
| Case 3 | Tên của vendor | `isInvalid`, `Description` và `ErrorMessage` là nội bộ của HeroUI; tên công khai là `hint`, `errorMessage` và `isError` | Thừa kế nguyên vẹn |
| Case 4 | Field mã một lần | `OtpInput invalid` → HeroUI `isInvalid` và `aria-invalid`; bản thân thông điệp phải nằm bên ngoài và nối qua `describedBy` | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/OtpInput.tsx

## FIELD-3 — Không dùng được vẫn giữ danh tính và công sức

Một field bị vô hiệu giữ nhãn và giá trị của nó; hình học chưa phân giải là một đầu vào khác.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Không thể tiếp tục sửa | `isDisabled` → HeroUI `TextField isDisabled`; nút bật tắt hiện mật khẩu nhận `disabled`; `label`, `value`/`defaultValue` và `hint` render không đổi | Thừa kế nguyên vẹn |
| Case 2 | Lý do thuộc về field | Slot `hint` sẵn có; không có prop `disabledReason` và không nên tự bịa cục bộ | Thừa kế nguyên vẹn |
| Case 3 | Nội dung ban đầu chưa phân giải | `isSkeleton` → `data-state="skeleton"` với hai khối HeroUI `Skeleton` (`h-4 w-1/3`, `h-10 w-full`) và không có nhãn, control hay thông điệp | Thừa kế nguyên vẹn |
| Case 4 | Field mã một lần | `OtpInput disabled` → HeroUI `isDisabled`; `gap` — không có đầu vào skeleton, nên hình học chưa phân giải của nó không có owner | Thừa kế nguyên vẹn |

Source: packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/OtpInput.tsx

## FIELD-4 — Bằng chứng và thứ bác bỏ

Quan hệ field được chứng minh từ cây đã render qua mọi state, không phải từ prop.

| Case | Luật | Owner của Common | Core hiện thực |
| --- | --- | --- | --- |
| Case 1 | Thuộc tính cần chụp | `data-component="Input"`, `data-state="skeleton"`, `disabled`, `required`, `aria-invalid` và `aria-describedby` gốc mà HeroUI `TextField` suy ra từ `isDisabled`, `isRequired`, `isInvalid`, `Description` và `ErrorMessage` | Core không phát thuộc tính field riêng nào |
| Case 2 | State cần chạy | Mặc định, đã điền, `isRequired`, không hợp lệ (`isError` hoặc `errorMessage`), `isDisabled`, `isSkeleton`, và từng kind bí mật khi hiện và khi ẩn | Thừa kế nguyên vẹn |
| Case 3 | Quy trách nhiệm theo tầng | Đầu ra Common cô lập, rồi delta của Core (binding token field trong `core/styles.css`), rồi delta của ứng dụng | Delta field của Core chính xác là năm binding `--field-*` |

Source: packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/styles.css
