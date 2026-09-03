# Mẫu mã nguồn frontend

`knowledge/ui/` quyết định giao diện phải là gì: đối tượng Grammar nào được vẽ, khoảng cách nào,
sắc thái nào. `knowledge/patterns/fe/` quyết định mã nguồn tạo ra giao diện ấy được viết ra sao:
một đơn vị mã nằm ở đâu, các tệp của nó tên gì, hàm component có hình dạng nào, chuỗi class đặt ở
đâu, thất bại được biểu diễn thế nào, và spec đi kèm nằm chỗ nào. Một luật mẫu không bao giờ chọn
hình ảnh; một luật `ui/` không bao giờ chọn tên tệp. Mọi luật dưới đây được rút ra từ
ứng dụng tham chiếu (`src/`) và gói Grammar của nó (`packages/grammar/src/`) bằng cách mở tệp và đếm, và
mỗi bảng đều dẫn nguồn tệp đã đọc. Nơi nào mã nguồn chia hai ngả, tệp ghi lại biến thể chiếm ưu thế
cùng con số thay vì áp đặt.

## Danh mục

| Tri thức | Quyết định điều gì | Luật |
| --- | --- | --- |
| [Thư mục](folder.vi.md) | Thư mục theo tầng, bộ tệp của một đơn vị, thứ một thư mục đơn vị không được chứa | FE-FOLDER-1 … FE-FOLDER-6 |
| [Đặt tên](naming.vi.md) | Tên thư mục, export, kiểu props, export class-name, hook, hằng và spec | FE-NAMING-1 … FE-NAMING-7 |
| [Hàm](function.vi.md) | Hình dạng component, tham số `props`, hợp đồng ba phần, helper, tệp route | FE-FUNCTION-1 … FE-FUNCTION-7 |
| [Import](imports.vi.md) | Alias `@/`, cửa vào Grammar, thứ tự import, chiều giữa các tầng, barrel hooks | FE-IMPORTS-1 … FE-IMPORTS-7 |
| [Chú thích](comment.vi.md) | Docblock cho export, chú thích trường, văn xuôi lý giải quyết định, câu `//`, nội dung bị cấm | FE-COMMENT-1 … FE-COMMENT-5 |
| [Kiểu](typing.vi.md) | `type` thay cho `interface`, `readonly`, union literal, `Array<T>`, kiểu trả về suy luận | FE-TYPING-1 … FE-TYPING-7 |
| [Lỗi](error.vi.md) | Thất bại là một trạng thái, phong bì GraphQL, `throw new Error`, toast | FE-ERROR-1 … FE-ERROR-5 |
| [Kiểm thử](test.vi.md) | Vị trí spec, spec nửa nối và nửa thuần, điều được khẳng định và điều không | FE-TEST-1 … FE-TEST-6 |

## Nguồn

Ứng dụng: `src/` của ứng dụng tham chiếu (976 tệp TypeScript không phải spec, 497 spec).
Gói Grammar: `packages/grammar/src/` của nó. Bộ luật lint chỉ được tra để
lấy tên luật: `@starci/eslint-canon-fe` như đã cài trong `node_modules`.
