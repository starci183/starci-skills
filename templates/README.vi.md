# Khuôn

Mỗi loại tài liệu một khuôn. Khuôn là bộ xương mà người viết chép lại, và bên trong nó có đúng một
khối fenced `json template-contract` mà `scripts/validate-templates.mjs` ép lên mọi file khuôn đó áp
vào, cùng bản `.vi.md` của file ấy. Hợp đồng là thẩm quyền; bộ xương là cách người đọc hiểu nó.

| Khuôn | Áp vào | Ép gì |
| --- | --- | --- |
| `context.template.md` | `operators/*/context.md` | tiêu đề; Mục đích, Các lớp context, Context bắt buộc, Ref kèm bảng alias, các mục luật tự do, Ranh giới, Tài nguyên |
| `input.template.md` | `operators/*/input.md` | tiêu đề; Vỏ ngoài, Các binding context, mục tự do, Input khi resume |
| `execute.template.md` | `operators/*/execute.md` | tiêu đề; Một việc duy nhất, các mục luật tự do, Trình tự kèm bảng bước, tự do, Thực thi khi resume, Các đòn tấn công bắt buộc |
| `output.template.md` | `operators/*/output.md` | tiêu đề; một mục `Receipt khi …`, tự do, Receipt khi blocked, Mã lỗi, Bất biến liên trường, Kết quả thực tế |
| `ui-composition.template.md` | `knowledge/ui/composition/*.md` | tiêu đề; chỉ các mục rule `PREFIX-n — …`, mỗi mục một bảng `Case \| Dùng khi \| Khẳng định`; mục đóng |
| `ui-presentation.template.md` | `knowledge/ui/presentation/*.md` | tiêu đề; Thang giá trị hoặc Danh mục, Owner kèm bảng, mục khung tự do — trong đó `<Topic> Common already owns` do `scripts/generate-presentation-owned.mjs` sinh ra chứ không viết tay — rule với một bảng `Case \| Dùng khi \| Owner \| Render`; mục đóng |
| `ui-proof.template.md` | `knowledge/ui/proof/*.md` | tiêu đề; chỉ các mục rule, mỗi mục một bảng `Case \| Dùng khi \| Quan sát`; mục đóng |
| `grammars.template.md` | `knowledge/grammars/*/*.md` | tiêu đề; mục tuỳ ý; mọi mục rule mang một bảng `Case \| Luật \| Owner của Common \| Core hiện thực` |
| `patterns.template.md` | `knowledge/patterns/*/*.md` | tiêu đề; mục tuỳ ý; mọi mục rule mang một bảng `Case \| Dùng khi \| Viết` |
| `changes.template.md` | `templates/changes.example.md` (ví dụ được ép; file thật nằm trong `@dynamic`) | tiêu đề; bảng Ràng buộc, bảng File, Bước kế tiếp cần biết gì |

## Từ vựng của hợp đồng

- `applies`: glob tính từ `.claude`; `*` không vượt qua dấu `/`. File `INDEX.md` không bao giờ bị
  nhận: chúng là chỉ mục để đọc, không phải tài liệu của một loại.
- `title`: biểu thức chính quy mà dòng đầu phải khớp, mỗi ngôn ngữ một cái.
- `sections`: các heading `##` phải có, theo thứ tự. `{ "free": true }` đánh dấu vùng tài liệu được
  thêm mục riêng; ngoài vùng tự do, một mục thừa là lỗi. Một mục có thể mang `table`, đúng dòng
  header bảng phải mở đầu mục đó.
- `rules`: `heading` là biểu thức của mục rule, `table` là dòng header duy nhất mỗi rule phải mang
  (đúng một bảng cho mỗi rule), `closing` là mục phải đứng cuối, `required` là tài liệu có bắt buộc
  publish ít nhất một rule không. Heading rule và heading đóng không tham gia bước duyệt `sections`.
- Mọi `.md` mà khuôn nhận phải có `.vi.md` cùng gốc, được kiểm theo dạng `vi` của cùng hợp đồng. Bản
  mirror là bản đọc cho người, không bao giờ là thẩm quyền lúc chạy.

## Đổi khuôn

Đổi hợp đồng, chạy `node scripts/validate-templates.mjs`, và đưa mọi tài liệu nó gọi tên về đúng
khuôn trong cùng một commit. Khuôn mà cây không thoả thì chưa được publish.
`scripts/validate-templates.spec.mjs` chứng minh chính validator trên một cây giả: tài liệu đúng khuôn
thì qua; thiếu mục, sai thứ tự, sai header bảng, thừa bảng dưới một rule, thiếu bản mirror đều bị chặn
kèm số dòng.
