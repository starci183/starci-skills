# Input cho `content.generate`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input` khai
đúng một đơn vị nội dung cần dựng cùng ranh giới nó được ghi. Trường không khai báo là không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `content.generate`.
- `context`: các binding thẩm quyền và bằng chứng, mô tả trong `context.vi.md`.
- `input`: đúng một đơn vị nội dung đã đóng băng.

## Các binding context

`context.curriculumRefs` và `context.sourceRefs` là bắt buộc và không rỗng, còn content source đã
route phải ràng `input.project.sourceHead`. `context.aiRuntime` bind cấu hình workspace và ấn định
brief cùng phần phê bình mỗi phần đúng một lần chạy mới tinh, không thừa kế lượt nào.
`context.styleRefs` và `context.auditRefs` là bằng chứng và được phép rỗng.

## Đơn vị nội dung

`input.unit` gọi tên một đơn vị, mục tiêu và đối tượng học của nó. `mode` là `generate` hoặc
`refactor`. Một lần refactor phải gọi tên đơn vị đang có trong `existingUnitRef`; một lần generate
phải để trống nó, vì một lần chạy lặng lẽ viết lại đơn vị cũ dưới một danh tính mới sẽ làm mất lịch sử
của những gì đã đổi.

## Ngôn ngữ

`naturalLanguages` khai những bản ngôn ngữ cần viết, và `targets.articleTargets` phải phủ đúng tập đó,
mỗi ngôn ngữ một đích. `implementationLanguages` khai tối đa bốn track lập trình cùng chia một hành
vi, và `targets.trackTargets` phải phủ đúng tập đó.

Một ngôn ngữ được khai mà không có đích là một ngôn ngữ mà khâu viết không thể giao, và chỉ bị phát
hiện sau khi brief đã đóng băng. Đó là input không hợp lệ, không phải bất ngờ lúc chạy.

## Chế độ của từng khâu

`input.stageModes` đặt `image`, `code` và `e2e` vào `required`, `optional` hoặc `disabled`.

- Khâu image bị tắt thì đích ảnh và đích prompt đều null; khâu bật thì phải có cả hai, vì hình được
  tạo ra theo một ý đồ đã nêu, và prompt chính là nơi ý đồ ấy được nêu ra.
- Khâu code bị tắt thì không có ngôn ngữ hiện thực nào và không có track target nào.
- Kiểm tra thực thi không được bật khi khâu code bị tắt: sẽ chẳng có gì để chạy. Các lệnh của nó phải
  phủ đúng tập ngôn ngữ hiện thực đã khai.

`maxE2eIterations` chặn trên vòng lặp chạy - đọc - sửa.

## Review

`input.review` mang vòng hiện tại, mức tối đa đã duyệt, và `minimumScore` cố định bằng `85`. Sàn điểm
là một phần của contract, không phải một tuỳ chọn theo từng lần gọi.

`targets.reviewTargetRef` phải khác `targets.briefTargetRef`. Ý đồ sản xuất và phán quyết độc lập là
hai bản ghi, và gộp chúng lại sẽ để cái này ghi đè cái kia.

## Input khi resume

`resume` là `null` cho lần gọi mới. Lần gọi resume cung cấp đúng receipt đã blocked, token dùng một
lần của nó, và những tham chiếu được thêm vào từ lúc đó. Project, source head, đơn vị, mode và các
ngôn ngữ đã khai phải bằng đúng receipt đã blocked. Một resume không thêm delta nào về curriculum,
source, finding hay phạm vi là không hợp lệ, dưới mã `NO_PROGRESS`.
