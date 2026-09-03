# Khuôn

Mỗi loại tài liệu một khuôn. Khuôn là bộ xương mà người viết chép lại, và bên trong nó có đúng một
khối fenced `json template-contract` mà `scripts/validate-templates.mjs` ép lên mọi file khuôn đó áp
vào, cùng bản `.vi.md` của file ấy. Hợp đồng là thẩm quyền; bộ xương là cách người đọc hiểu nó.

| Khuôn | Áp vào | Ép gì |
| --- | --- | --- |
| `ui-composition.template.md` | `knowledge/ui/composition/*.md` | tiêu đề; chỉ các mục rule `PREFIX-n — …`, mỗi mục một bảng `Case \| Dùng khi \| Khẳng định`; mục đóng |
| `ui-presentation.template.md` | `knowledge/ui/presentation/*.md` | tiêu đề; Thang giá trị hoặc Danh mục, Owner kèm bảng, mục khung tự do — trong đó `<Topic> Common already owns` do `scripts/generate-presentation-owned.mjs` sinh ra chứ không viết tay — rule với một bảng `Case \| Dùng khi \| Owner \| Render`; mục đóng |
| `ui-proof.template.md` | `knowledge/ui/proof/*.md` | tiêu đề; chỉ các mục rule, mỗi mục một bảng `Case \| Dùng khi \| Quan sát`; mục đóng |
| `grammars.template.md` | `knowledge/grammars/*/*.md` | tiêu đề; mục tuỳ ý; mọi mục rule mang một bảng `Case \| Luật \| Owner của Common \| Core hiện thực` |
| `patterns.template.md` | `knowledge/patterns/*/*.md` | tiêu đề; mục tuỳ ý; mọi mục rule mang một bảng `Case \| Dùng khi \| Viết` |
| `kinds/changes.contract.json` + `kinds/changes.skeleton.md` | `response/changes.md` trong một nhánh của phiên; `templates/changes.example.md` là ví dụ được ép | tiêu đề; bảng Binding, bảng Files, Bước kế tiếp cần biết gì |
| `operator.template.md` | `operators/*/operator.md` | tiêu đề `# <operator.id>`; Việc, các mục luật tự do, Context, Đầu vào, Yêu cầu, Các bước, Đầu ra, Dừng, Kế tiếp, mỗi mục một bảng; `scripts/validate-operator.mjs` sau đó đối chiếu các bảng với nhau, với `errors/` và với `templates/kinds` |
| `kinds/<kind>.contract.json` | file markdown trong một nhánh của phiên (`response/response.md`, `critique/response/critique.md`) | JSON thuần, kiểm bằng `kinds/contract.schema.json`: regex tiêu đề, mục theo thứ tự, header từng bảng, số dòng, dòng bắt buộc, regex ô; `kinds/<kind>.skeleton.md` là bộ xương để chép và tự nó phải qua hợp đồng; `scripts/validate-response.mjs` nạp hợp đồng theo kind |
| `kinds/<kind>.schema.json` | `response/data/<name>.json` trong một nhánh của phiên | JSON Schema của một kind máy |
| `step/request.schema.json`, `step/response.schema.json` | `request/request.json` và `response/response.json` của mọi nhánh và mọi cuộc trao đổi lồng | hai gate dùng chung cho mọi operator; `scripts/validate-request.mjs` chạy trước agent, `scripts/validate-response.mjs` chạy sau |
| `kinds/` kind artifact | file mà operator khai kiểu `artifact` (`alternatives`, `direction-image`, `resolved-tree`, `screenshot`, `sheet`, `article`, `image`, `image-prompt`, `track`) | cố ý không có hợp đồng hay schema: validator chỉ kiểm file tồn tại và được trỏ tới; `validate.mjs` của operator có thể soi thêm |

## Từ vựng của hợp đồng

- `applies`: glob tính từ `.claude`; `*` không vượt qua dấu `/`. File `INDEX.md` không bao giờ bị
  nhận: chúng là chỉ mục để đọc, không phải tài liệu của một loại.
- `title`: biểu thức chính quy mà dòng đầu phải khớp, mỗi ngôn ngữ một cái.
- `sections`: các heading `##` phải có, theo thứ tự. `{ "free": true }` đánh dấu vùng tài liệu được
  thêm mục riêng; ngoài vùng tự do, một mục thừa là lỗi. Một mục có thể mang `table`, đúng dòng
  header bảng phải mở đầu mục đó.
- Mục có `table` còn có thể mang `minRows` / `exactRows` (số dòng dữ liệu), `rows` (giá trị cột đầu phải
  xuất hiện, bỏ qua dấu backtick) và `cell` (`{ "<Cột>": "<regex>" }`, ô dưới cột đó ở mọi dòng phải khớp;
  cột không có trong header của ngôn ngữ này thì bỏ qua). Hợp đồng kind dưới `kinds/` là JSON một ngôn ngữ:
  `title`, `heading` và `table` là chuỗi trơn.
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
