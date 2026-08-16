# áp dụng lint

## Định nghĩa

Áp dụng lint là cấu hình ESLint thực sự được áp dụng lên một file production có thật; không phải là
việc có một thư mục plugin, một lệnh import hay một bộ rule cục bộ có tên tương tự. Câu hỏi quyết
định là: `eslint --print-config` có hiển thị mọi rule FE canon của StarCi ở mức `error` và từ chối
inline config hay không?

Luật này được bảo đảm bởi
[`sources/fe/lint-adoption.mjs`](../../../sources/fe/lint-adoption.mjs). Module này audit cấu hình
đã resolve sau khi ESLint gộp mọi lớp cấu hình. Gate của repository là
[`scripts/audit-fe-lint-adoption.mjs`](../../../scripts/audit-fe-lint-adoption.mjs).

Implementation anchors in `starci-academy-fe`: `eslint.config.mjs` and
`plugins/eslint/index.mjs`. Đây là bằng chứng cần kiểm tra tại commit Context Lock, không phải thứ
có thể thay thế cho effective-config audit.

## Luật

**LINT-ADOPTION-1.** Project sử dụng phải gắn plugin FE StarCi, recommendation và các tùy chọn
linter đã tập hợp thành một đơn vị có version, vì một subset tự viết trong project sẽ trở thành canon
thứ hai ngay khi một trong hai danh sách thay đổi.

**LINT-ADOPTION-2.** Project phải chạy canonical effective-config audit trên ít nhất một file source
production có thật, vì việc load plugin chỉ chứng minh rằng các rule tồn tại, không chứng minh ESLint
đã bật chúng.

**LINT-ADOPTION-3.** Mọi rule trong canonical recommendation phải resolve thành `error`, vì một
plugin tự viết chạy song song hoặc rollout ở mức warning sẽ tạo ra một kiến trúc thứ hai, yếu hơn.

**LINT-ADOPTION-4.** Cấu hình đã resolve phải đặt `linterOptions.noInlineConfig` thành `true`, vì
inline disable biến trust của repository thành lựa chọn riêng của caller.

**LINT-ADOPTION-5.** Apply và công việc fidelity phải dừng trước khi sửa production nếu audit này
thất bại, vì code được viết dưới cơ chế thực thi chưa đầy đủ có thể hợp lệ cục bộ nhưng vẫn vi phạm
canon.

## Forbidden

| Không bao giờ | Vì sao bị từ chối | Thay vào đó |
|---|---|---|
| Khẳng định đã áp dụng chỉ vì đã import plugin `starci-fe` | Plugin được import có thể thiếu rule hoặc không bật chúng | Audit `eslint --print-config` trên một file production có thật |
| Giữ một subset tự viết chạy song song làm nguồn có thẩm quyền của project | Canon và subset sẽ tự lệch nhau | Gắn plugin FE StarCi, recommendation và tùy chọn linter đã tập hợp, rồi chứng minh parity thực tế |
| Hạ debt còn thiếu xuống warning | Warning biến ranh giới kiến trúc thành tùy chọn | Sửa debt hiện có, sau đó bật toàn bộ strict set |
| Bắt đầu Apply khi việc áp dụng chưa đạt | Code mới đang được đánh giá bằng trust chưa đầy đủ | Sửa wiring của lint trong boundary đã được duyệt hoặc dừng lại |

## Ví dụ

Đúng: chạy audit trên `src/components/pages/DashboardPage/component.tsx` và chỉ tiếp tục sau khi
audit trả về `ok: true`.

Sai: chỉ vào `plugins/eslint/index.mjs` rồi gọi project là đã áp dụng mà không kiểm tra cấu hình đã
resolve. Khác biệt nằm ở việc thực thi có hiệu lực, không phải sự hiện diện của file.

Đúng: giữ mọi rule canonical ở mức `error` và `noInlineConfig: true`.

Sai: bật phần lớn rule ở mức `error` nhưng bỏ sót các rule canon mới thêm. Khác biệt nằm ở parity
đầy đủ với canon, không phải tên plugin quen thuộc.
