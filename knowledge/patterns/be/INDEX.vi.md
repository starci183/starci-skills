# Mẫu mã nguồn backend

`knowledge/ui/` quyết định giao diện phải là gì. `knowledge/patterns/be/` quyết định mã NestJS
đứng sau giao diện ấy được viết ra sao: một tệp nằm dưới gốc nào, các tệp của một đơn vị GraphQL
tên gì, một handler có hình dạng nào, một import dùng alias nào, docblock đứng ở đâu so với
decorator, một exception được khai báo thế nào và được ánh xạ sang HTTP và GraphQL ở đâu, và spec
nằm chỗ nào. Mọi luật dưới đây được rút ra từ source backend tham chiếu lịch sử bằng cách mở tệp và đếm; mỗi bảng dẫn nguồn của nó. Nơi nào mã nguồn chia
hai ngả, tệp ghi lại biến thể chiếm ưu thế cùng con số thay vì áp đặt. Tên luật lint từ chính
ESLint config của project tham chiếu chỉ được dẫn ở nơi mã đã tuân theo.

Phạm vi áp dụng: đây là quan sát nguồn tham chiếu lịch sử được giữ ở commit skill
`edf72554425f918e80c9205e9c6db10596e722f0`, không phải luật framework phổ quát hoặc bằng chứng
source dự án hiện tại. Kiểm tra repository, type/API, alias, cấu hình lint/test thực tế đã chọn;
chỉ dùng mẫu hợp với scope `.work` được duyệt. Số đếm cũ không được dùng để tuyên bố scan mới.
Yêu cầu nghiệp vụ và kiến trúc hiện tại thuộc node `.work`, không suy ra thành đã duyệt từ mẫu code.

## Danh mục

| Tri thức | Quyết định điều gì | Luật |
| --- | --- | --- |
| [Thư mục](folder.vi.md) | `features/` so với `modules/`, bộ tệp của một đơn vị GraphQL, nơi đặt exception, entity và kiểm thử | BE-FOLDER-1 … BE-FOLDER-7 |
| [Đặt tên](naming.vi.md) | Hậu tố tệp kebab, hậu tố vai trò của lớp, danh tính exception, enum, hằng, phương thức | BE-NAMING-1 … BE-NAMING-8 |
| [Hàm](function.vi.md) | `process` của handler, phong bì thông điệp, `execute` của service và resolver, tiêm qua constructor, helper | BE-FUNCTION-1 … BE-FUNCTION-8 |
| [Import](imports.vi.md) | Alias `@modules`/`@features`/`@tests`, kiểu ngoặc, thứ tự, chiều phân tầng, import bị cấm | BE-IMPORTS-1 … BE-IMPORTS-7 |
| [Chú thích](comment.vi.md) | Docblock sau decorator, trách nhiệm thay vì tên, chú thích thành viên enum, câu `//`, ASCII và `vn-ok` | BE-COMMENT-1 … BE-COMMENT-7 |
| [Kiểu](typing.vi.md) | `interface` thay `type`, tham số có tên, `readonly`, enum, không `any`, lớp GraphQL | BE-TYPING-1 … BE-TYPING-7 |
| [Lỗi](error.vi.md) | Hình dạng `AbstractException`, metadata, bọc lỗi, bộ lọc HTTP, interceptor GraphQL và `formatError` | BE-ERROR-1 … BE-ERROR-7 |
| [Kiểm thử](test.vi.md) | `.spec.ts` kề bên, làn theo hậu tố, khởi tạo trực tiếp với `as never`, điều một khẳng định chứng minh | BE-TEST-1 … BE-TEST-7 |

## Nguồn

Source backend tham chiếu lịch sử, `apps/core/src/app.module.ts` cho
việc đăng ký bộ lọc, `tsconfig.json`, `jest.config.ts`, `eslint.config.mjs`.
