# Knowledge

Cây này chứa decision authority, không chứa workflow.

| Nhánh | Sở hữu | Không được sở hữu |
| --- | --- | --- |
| [`ui/`](ui/INDEX.vi.md) | Rule condition-to-Grammar dùng chung giữa family, ví dụ Core thực dụng, quan hệ UI đo được và review falsifier | Business fact, copy page, route, identity artwork, effect một lần hay operator orchestration |
| [`grammars/starci/`](grammars/starci/INDEX.vi.md) | Exact public export của StarCi, contract component/state/composition, direct consumption và luật extension của derived family | Product truth, substitute cục bộ hay sửa Grammar output ở app |

Chỉ load file `.md` tiếng Anh canonical và indexed rule nhỏ nhất có thể đổi quyết định hiện tại. File
`.vi.md` cùng stem là mirror cho người đọc, không được vào runtime context. Knowledge file bỏ routing
metadata riêng theo topic; Grammar operator sở hữu lookup và orchestration.

`@starci/grammar/core` là reference compatibility contract. Derived Grammar đã publish được override
CSS có scope theo family, thay renderer/element Core hiện có và thêm element qua extension point đã
khai báo, đồng thời giữ public prop, meaning, state behavior, accessibility, ownership và
substitutability. Application chọn đúng một family và truyền product truth; không patch CSS hay
import primitive song song.

Khi cả hai nhánh cùng áp dụng, UI knowledge chọn quan hệ và Grammar đã chọn bind quan hệ đó vào public
interface chính xác. Typed family registration hoặc component/prop còn thiếu vẫn là `grammar-gap`;
không nhánh nào được bịa API runnable hay âm thầm override nhánh kia.
