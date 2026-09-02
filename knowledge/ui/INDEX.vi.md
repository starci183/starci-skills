# Knowledge UI

Thư mục này là UI detector contract universal, dùng chung cho mọi Grammar family đã publish.
Nó sở hữu 118 law X-n ổn định (40 ở composition, 59 ở presentation, 19 ở proof), selection condition
quan sát được, ownership decision, deterministic verdict và audit vector. Đây không phải implementation hay consumer cookbook. Nó không sở hữu business fact, copy riêng của page, route, permission,
identity artwork, effect sản phẩm hay lựa chọn material của family.
## Ba nhóm

Một topic sống cùng operator đọc nó. Topic nào không operator nào đọc thì không có lý do tồn tại.

| Nhóm | Quyết định | Ai đọc |
| --- | --- | --- |
| [`composition/`](composition/INDEX.vi.md) | Cây phải chứa gì, quyết trước khi cây tồn tại | `fe.direction.decide` |
| [`presentation/`](presentation/INDEX.vi.md) | Ranh giới do app sở hữu lấy giá trị CSS nào | `fe.presentation.resolve` |
| [`proof/`](proof/INDEX.vi.md) | Thứ chỉ đúng sai sau khi đã render | `fe.surface.audit` |

Phép thử để xếp một topic là: đọc source có trả lời được không. Giá trị khoảng cách đọc được từ class
nên thuộc presentation. Số hành động trội đã chốt trước khi có cây nên thuộc composition. Thứ tự bàn
phím có khớp thứ tự nhìn thấy hay không thì phải chạy mới biết, nên thuộc proof.

Quy ước viết code sinh ra tất cả những thứ này nằm ở [`patterns/`](../patterns/fe/INDEX.vi.md), còn
phần hiện thực của từng họ nằm ở [`grammars/`](../grammars/starci/INDEX.vi.md).

