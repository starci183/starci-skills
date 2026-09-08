# UI composition

Composition là tầng quyết định chạy trước khi có bất kỳ cây DOM nào:

```text
business
-> composition quyết định vùng, cấp độ, action, state và điểm nhấn
-> presentation chốt giá trị CSS trên boundary do app sở hữu
-> UI đã render
```

Mọi rule trong folder này được operator direction tiêu thụ. Operator đó trả lời những câu hỏi phải
chốt xong khi trang vẫn còn là một bản mô tả: trang có những vùng nào, nội dung nào đứng trên nội
dung nào, action nào mang quyết định, tính năng có thể rơi vào những điều kiện nào, người đọc được
nói gì ở mỗi kết cục, và phần nhấn mạnh mạnh nhất vốn khan hiếm thì tiêu ở đâu. Những chủ đề này
nằm chung một chỗ vì mỗi cái đều là một cam kết đưa ra trước lúc render, và vì chúng ràng buộc lẫn
nhau: một vùng không có anchor thì chẳng có cấp độ nào để tiêu accent lên, còn một state không có
carrier thì feedback không có gì để mô tả. Không thứ gì ở đây sửa được bằng một giá trị CSS về sau,
và đó chính là lý do nó được quyết trước.

## Danh mục

| Knowledge | Quyết định điều gì | Rule |
| --- | --- | --- |
| [Layout](layout.vi.md) | Trang có những vùng nhiệm vụ nào, ai sở hữu track và scroll của chúng | LAYOUT-1 đến LAYOUT-4 |
| [Hierarchy](hierarchy.vi.md) | Mỗi mảng ý nghĩa nhận cấp độ thông tin nào | HIERARCHY-1 đến HIERARCHY-5 |
| [Responsive](responsive.vi.md) | Cái gì sống sót khi không gian đổi, và query nào sở hữu thay đổi đó | RESPONSIVE-1 đến RESPONSIVE-4 |
| [CTA](cta.vi.md) | Action nào mang quyết định, và điểm nhấn của nó hứa điều gì | CTA-1 đến CTA-5 |
| [Action](action.vi.md) | Một lần kích hoạt làm gì, ai sở hữu hiệu ứng và trạng thái pending | ACTION-1 đến ACTION-3 |
| [State](state.vi.md) | Có những điều kiện nào, và carrier công khai nào giữ từng cái | STATE-1 đến STATE-7 |
| [Feedback](feedback.vi.md) | Ai báo lỗi, ai chỉ cách sửa, ai phục hồi, ai công bố kết quả | FEEDBACK-1 đến FEEDBACK-3 |
| [Accent](accent.vi.md) | Phần nhấn mạnh mạnh nhất và khan hiếm được tiêu ở đâu | ACCENT-1 đến ACCENT-5 |
| [Coverage](coverage.vi.md) | Receipt của direction phải liệt kê những gì trước khi được phát ra | COVERAGE-1 |

Năm rule phạm vi của từng chủ đề đã gộp vào COVERAGE-1, và một địa chỉ đã nghỉ thì không dùng lại:
đã nghỉ là `ACTION-4`, `STATE-4`, `FEEDBACK-4`, `LAYOUT-5` và `RESPONSIVE-5`.

## Cấu trúc rule

`LAYOUT-1`, `STATE-5` và các tên `PREFIX-n` khác là địa chỉ thứ tự ổn định trong chủ đề của chúng.
Con số không phải mức độ nghiêm trọng, không phải variant của component, cũng không phải một vị trí
trên thang giá trị.

Mỗi rule gồm heading, một dòng gọi tên thứ mà rule chi phối, và đúng một bảng:

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Tình huống cụ thể dẫn tới rule này. | Một khẳng định phủ định được về receipt của direction hoặc về cây đã dựng, viết bằng ngôn ngữ mà phía sản phẩm đọc được. |

Ô `Khẳng định` nêu một mệnh đề mà receipt hoặc cây đã dựng hoặc thoả hoặc trượt, không phải lời
khuyên và không phải tên class. Nó có thể gọi tên một component hay prop công khai khi đó chính là
thứ phải được mang, nhưng nó không bao giờ chốt một giá trị CSS; phần đó thuộc về presentation. Bố
cục và gu thẩm mỹ được quyết trong `@knowledge/grammars/<family>`; các rule ở đây chỉ nói một direction
phải thoả điều gì.

Một case thuộc về rule hàng xóm thì không nằm trong bảng. Nó đứng thành một dòng ngay sau bảng, theo
dạng `Không phải rule này: <điều kiện> thuộc PREFIX-n`. Mỗi file khép lại bằng mục
`## File này không quyết định`, dẫn sang các file anh em và sang nhóm proof, nơi kết quả được quan
sát.

Tên component và tên prop trong các file này đều phải phân giải được về `@grammar/common`.
Một API không tồn tại ở đó thì không được viết vào rule; một năng lực cần mà chưa có thì ghi nhận
thành capability gap.
