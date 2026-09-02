# Mẫu mã nguồn backend

`knowledge/ui/` quyết định giao diện phải là gì. `knowledge/patterns/be/` quyết định mã NestJS
đứng sau giao diện ấy được viết ra sao: một tệp nằm dưới gốc nào, các tệp của một đơn vị GraphQL
tên gì, một handler có hình dạng nào, một import dùng alias nào, docblock đứng ở đâu so với
decorator, một exception được khai báo thế nào và được ánh xạ sang HTTP và GraphQL ở đâu, và spec
nằm chỗ nào. Mọi luật dưới đây được rút ra từ `starci-academy-backend/src/` bằng cách mở tệp và
đếm; mỗi bảng dẫn nguồn của nó. Nơi nào mã nguồn chia hai ngả, tệp ghi lại biến thể chiếm ưu thế
cùng con số thay vì áp đặt. Tên luật lint từ `@starci/eslint-canon-be` chỉ được dẫn ở nơi mã đã
tuân theo.

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

`D:\Repositories\starci-academy-backend\src\` (4463 tệp TypeScript không phải spec, 875 spec đơn
vị, 7 spec tích hợp), `apps/core/src/app.module.ts` cho việc đăng ký bộ lọc, `tsconfig.json`,
`jest.config.ts`, `eslint.config.mjs`.
