> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> mechanics, not an application decision. It has no successor under composition, presentation, or
> proof. Do not load it as runtime authority.

# Field

Dùng các rule này để audit label, control, guidance, validation, requirement, value và availability
của một field như một relationship có một owner. Business/application authority cung cấp domain
copy, value, validation fact và mutation; `@starci/grammar/common` sở hữu public field prop, anatomy,
DOM relationship và accessibility; family được đổi paint trong scope nhưng không đổi contract đó.
Binding component với rule nằm trong binding registry riêng. Ghi finding theo
[mô hình verdict canonical](INDEX.vi.md#canonical-verdict-model), mỗi finding có một base verdict và
dùng finding liên kết cho các layer fail độc lập.

## FIELD-1 — Một owned field stack

### When

Một editable value cần visible identity và có thể cần thêm guidance, validation, requirement hoặc
availability state.

### Apply

- Dùng Common `Input` làm owner duy nhất và truyền các public slot thật: `id`, `name`, `label`, value
  hoặc `defaultValue`, `hint`, `errorMessage`, `isError`, `isDisabled`, `isRequired` và
  `onValueChange` khi áp dụng.
- Common compose label, description, native input và internal error-message renderer dưới một
  text-field owner; verify accessible name và description đã render thay vì suy từ tên source component.
- Application sở hữu words, current value, validation fact và change effect. Family được style
  published anatomy, nhưng không layer nào được thêm field wrapper hay vendor leaf thứ hai.
- Yêu cầu một visible label, một editable control, một value authority và không có label,
  guidance hay error owner tách rời/trùng lặp.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Common `Input` render “Email công việc”, native input có tên, hint và authority-backed value như một relationship. | `PASS` | Public owner và semantic relationship đã render khớp nhau. |
| Common chưa có reusable field owner cho một control shape bắt buộc. | `COMMON_CAPABILITY_MISSING` | Thêm named capability Common trước khi app ghép vendor leaf. |
| App bọc Common `Input` bằng hệ label và description thứ hai. | `APP_REIMPLEMENTATION` + `DOUBLE_OWNER` | Bỏ wrapper trùng và truyền content qua Common slot. |
| Family replacement làm mất label nhưng vẫn giữ input. | `FAMILY_OVERRIDE_GLITCH` + `WRONG_OWNER` | Khôi phục field anatomy đầy đủ, tương thích prop. |
| Screenshot có label nhưng chưa trace accessible name hoặc description. | `PROOF_MISSING` | Capture semantic tree đã render và relationship ID trước khi PASS. |

## FIELD-2 — Helper và error có job khác nhau

### When

Field có thể cần guidance dùng trước khi nhập và corrective validation message cho lỗi hiện tại.

### Apply

- Đặt guidance về format hoặc consequence trong `Input.hint`; đặt failure hiện tại và cách sửa trong
  `Input.errorMessage`. Có `errorMessage`, hoặc public `isError`, làm Common field invalid.
- `isError` là Common public state prop. HeroUI `isInvalid` và `ErrorMessage` trong renderer là vendor
  detail nội bộ, không phải Common API cho app hay app slot độc lập.
- Update hoặc remove `errorMessage` khi validation truth đổi. Verify visible copy, `aria-invalid` và
  programmatic description của field trong cùng rendered state.
- Family được paint invalid state nhưng không được ẩn corrective copy. App sở hữu validation truth và
  wording, không sở hữu error anatomy hay live/error region thứ hai.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| `hint="Dùng địa chỉ công việc"` là guidance; value bị reject dùng `errorMessage="Nhập email công việc"` và render invalid semantics. | `PASS` | Guidance và correction có content riêng cùng một Common owner. |
| App import vendor `ErrorMessage` cạnh Common `Input`. | `APP_REIMPLEMENTATION` + `VENDOR_LEAK` + `DOUBLE_OWNER` | Bỏ vendor leaf và dùng `Input.errorMessage`. |
| App xem vendor `isInvalid` như một prop của Common `Input`. | `APP_REIMPLEMENTATION` + `VENDOR_LEAK` | Bind business fact vào public `isError` hoặc `errorMessage`. |
| Isolated Common hiện `errorMessage` nhưng không expose invalid hay descriptive semantics. | `COMMON_IMPLEMENTATION_GLITCH` | Sửa Common mapping và thêm coverage DOM đã render. |
| Error trông đúng nhưng chưa inspect relationship với input. | `PROOF_MISSING` | Verify accessible name, invalid state và description cùng nhau. |

## FIELD-3 — Unavailability giữ identity và work

### When

Một field đã biết và value của nó vẫn liên quan, nhưng edit hiện không thể bắt đầu hay tiếp tục.

### Apply

- Giữ nguyên Common `Input` mounted và truyền `isDisabled`; giữ `label` cùng authority-backed `value`
  hoặc `defaultValue` hiện tại thay vì clear hay replace.
- Nếu reason thuộc guidance của field, application truyền qua slot `hint` đang có. Common không
  expose prop `disabledReason` riêng; không invent prop đó ở local.
- Verify native input bị disabled, visible identity và value vẫn còn, `onValueChange` không mutate
  authority, và khi enable lại thì work đã giữ được tiếp tục.
- Chỉ dùng `isSkeleton` cho initial field geometry chưa resolve. Family được paint disabled state
  nhưng không được biến nó thành loading hoặc che value.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Email `Input` disabled giữ label và địa chỉ đã verify visible; không change callback nào mutate value. | `PASS` | Availability đổi mà không xóa identity hay work. |
| App clear value khi permission chuyển thành unavailable. | `APP_OVERRIDE` + `STATE_OR_VIEWPORT_DRIFT` | Giữ authority-backed value và chỉ disable editing. |
| App thay `isDisabled` bằng `isSkeleton` cho field đã biết. | `APP_OVERRIDE` + `VALUE_DRIFT` | Drive `isDisabled`; skeleton nghĩa initial content chưa resolve. |
| Family ẩn disabled text hoặc visible label. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Khôi phục identity và value đọc được dưới disabled paint. |
| Chưa exercise path enable lại và value preservation. | `PROOF_MISSING` | Ghi value, callback count và semantics trước, trong và sau disablement. |

## FIELD-4 — Evidence và falsifier

### When

Label, value, requirement, validation, availability, skeleton, input method, text scale hoặc viewport
có thể làm đổi rendered relationship của field.

### Apply

- Execute matrix cho default, filled, required, invalid, disabled và skeleton cùng mọi value
  transition và correction path liên quan.
- Inspect source public prop, isolated Common DOM, selected family delta, app wrapper, visible copy,
  native input behavior, focus order và accessibility tree.
- Yêu cầu một accessible name, description hiện hành, required/invalid/disabled semantics đúng,
  disabled mutation = `0`, known value được giữ và unresolved content được ẩn ở nơi contract yêu cầu.
- Gán từng failure độc lập cho Common, family hoặc app; giống về visual và vendor behavior suy từ
  source không phải runtime proof.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Mọi state bắt buộc có visible copy, native semantics, relationship, value và callback evidence khớp. | `PASS` | Field contract đầy đủ đã được chứng minh. |
| Isolated Common duplicate error trong hai described node. | `COMMON_IMPLEMENTATION_GLITCH` + `DOUBLE_OWNER` | Giữ một Common error relationship rồi chạy lại semantic-tree test. |
| App CSS ẩn visible label, chỉ để placeholder. | `APP_OVERRIDE` + `WRONG_OWNER` | Bỏ override; placeholder không phải field identity. |
| Family làm invalid và default field không phân biệt được. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Khôi phục invalid treatment nhận biết được mà không đổi Common state. |
| Chỉ kiểm tra default desktop output. | `PROOF_MISSING` | Thêm evidence required, invalid, disabled, skeleton, keyboard, text scale và reflow. |
